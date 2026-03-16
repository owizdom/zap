import {
  StarkZap,
  StarkSigner,
  OnboardStrategy,
  Amount,
  fromAddress,
  sepoliaTokens,
  mainnetTokens,
  Staking,
  sepoliaValidators,
  ChainId,
  getStakingPreset,
} from "starkzap";
import type { PoolMember, Token } from "starkzap";

const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "sepolia") as "sepolia" | "mainnet";

// Nethermind — reliable validator on Sepolia and Mainnet
const VALIDATOR = sepoliaValidators.NETHERMIND;

function getSdk(withPaymaster = true) {
  return new StarkZap({
    network: NETWORK,
    ...(withPaymaster && { paymaster: { nodeUrl: "https://starknet.paymaster.avnu.fi" } }),
  });
}

export function getTokens() {
  return NETWORK === "sepolia" ? sepoliaTokens : mainnetTokens;
}

export async function getEscrowWallet(withPaymaster = true) {
  const privateKey = process.env.ESCROW_PRIVATE_KEY;
  if (!privateKey) throw new Error("ESCROW_PRIVATE_KEY not set");
  const { wallet } = await getSdk(withPaymaster).onboard({
    strategy: OnboardStrategy.Signer,
    account: { signer: new StarkSigner(privateKey) },
    deploy: "if_needed",
  });
  return wallet;
}

export function getEscrowAddress(): string {
  return process.env.ESCROW_ADDRESS || "";
}

function isPaymasterError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return msg.includes("paymaster") || msg.includes("max_fee") || msg.includes("fee budget") || msg.includes("insufficient_max_fee");
}

// ─── Staking helpers ──────────────────────────────────────────────────────────

function getStakingDeps() {
  const sdk = getSdk(false);
  const provider = sdk.getProvider();
  const chainId = NETWORK === "sepolia" ? ChainId.SEPOLIA : ChainId.MAINNET;
  const stakingConfig = getStakingPreset(chainId);
  return { provider, stakingConfig };
}

async function getStakingInstance(): Promise<Staking> {
  const { provider, stakingConfig } = getStakingDeps();
  const tokens = getTokens();
  return Staking.fromStaker(VALIDATOR.stakerAddress, tokens.STRK, provider, stakingConfig);
}

// ─── Staking — public API ────────────────────────────────────────────────────

/**
 * Stake STRK from the escrow wallet into the validator pool.
 * Uses TxBuilder for an atomic approve + enter/add multicall.
 */
export async function stakeEscrow(amountRaw: string): Promise<string> {
  const wallet = await getEscrowWallet(false);
  const tokens = getTokens();
  const staking = await getStakingInstance();
  const amount = Amount.fromRaw(BigInt(amountRaw), tokens.STRK);
  // TxBuilder: atomic approve + stake in one tx
  const tx = await wallet.tx()
    .stake(staking.poolAddress, amount)
    .send();
  await tx.wait();
  return tx.hash;
}

/**
 * Claim accumulated staking rewards to the escrow wallet.
 * Uses TxBuilder. Returns tx hash or null if nothing to claim.
 */
export async function claimStakingRewards(): Promise<string | null> {
  try {
    const wallet = await getEscrowWallet(false);
    const staking = await getStakingInstance();
    const position = await staking.getPosition(wallet);
    if (!position || position.rewards.isZero()) return null;
    const tx = await wallet.tx()
      .claimPoolRewards(staking.poolAddress)
      .send();
    await tx.wait();
    return tx.hash;
  } catch (err) {
    console.warn("[staking] claimRewards failed:", String(err));
    return null;
  }
}

/**
 * Initiate exit from the delegation pool for a given raw STRK amount.
 * After calling this, wait for the exit window (~21 days on mainnet),
 * then call exitFromPool() to complete withdrawal.
 */
export async function exitIntentFromPool(amountRaw: string): Promise<string> {
  const wallet = await getEscrowWallet(false);
  const tokens = getTokens();
  const staking = await getStakingInstance();
  const amount = Amount.fromRaw(BigInt(amountRaw), tokens.STRK);
  const tx = await wallet.tx()
    .exitPoolIntent(staking.poolAddress, amount)
    .send();
  await tx.wait();
  return tx.hash;
}

/**
 * Complete exit from the delegation pool after the exit window has passed.
 * Transfers unstaked tokens back to the escrow wallet.
 */
export async function exitFromPool(): Promise<string> {
  const wallet = await getEscrowWallet(false);
  const staking = await getStakingInstance();
  const tx = await wallet.tx()
    .exitPool(staking.poolAddress)
    .send();
  await tx.wait();
  return tx.hash;
}

/**
 * Get the current staking position for the escrow wallet.
 */
export async function getStakingPosition(): Promise<PoolMember | null> {
  try {
    const wallet = await getEscrowWallet(false);
    const staking = await getStakingInstance();
    return staking.getPosition(wallet);
  } catch {
    return null;
  }
}

/**
 * Returns all tokens that are currently enabled for staking in the protocol.
 * Dynamically discovered — not hardcoded.
 */
export async function getActiveStakingTokens(): Promise<Token[]> {
  try {
    const { provider, stakingConfig } = getStakingDeps();
    return Staking.activeTokens(provider, stakingConfig);
  } catch {
    return [];
  }
}

export function getValidatorInfo() {
  return { name: VALIDATOR.name, stakerAddress: VALIDATOR.stakerAddress };
}

// ─── Transfer ────────────────────────────────────────────────────────────────

/**
 * Transfer tokens from escrow to a recipient via TxBuilder.
 * Tries gasless first, falls back to direct if paymaster fails.
 */
export async function releaseToRecipient(
  recipientAddress: string,
  amountStr: string,
  tokenSymbol = "STRK"
): Promise<string> {
  const tokens = getTokens();
  const token = tokens[tokenSymbol as keyof typeof tokens] ?? tokens.STRK;
  const transfer = { to: fromAddress(recipientAddress), amount: Amount.parse(amountStr, token) };

  try {
    const wallet = await getEscrowWallet(true); // gasless
    const tx = await wallet.tx().transfer(token, transfer).send();
    await tx.wait();
    return tx.hash;
  } catch (err) {
    if (isPaymasterError(err)) {
      console.warn("[escrow] Paymaster failed, retrying without paymaster:", String(err));
      const wallet = await getEscrowWallet(false);
      const tx = await wallet.tx().transfer(token, transfer).send();
      await tx.wait();
      return tx.hash;
    }
    throw err;
  }
}

export async function getEscrowBalance(tokenSymbol = "STRK"): Promise<string> {
  const wallet = await getEscrowWallet(false);
  const tokens = getTokens();
  const token = tokens[tokenSymbol as keyof typeof tokens] ?? tokens.STRK;
  const balance = await wallet.balanceOf(token);
  return balance.toFormatted();
}

// ─── Live APY ────────────────────────────────────────────────────────────────

let _cachedApy: number | null = null;
let _cacheTime = 0;

export async function getLiveApy(): Promise<number> {
  if (_cachedApy !== null && Date.now() - _cacheTime < 3_600_000) return _cachedApy;
  try {
    const staking = await getStakingInstance();
    const commission = await staking.getCommission();
    const grossApy = 0.05;
    const netApy = grossApy * (1 - commission / 100);
    _cachedApy = netApy > 0 ? netApy : grossApy;
    _cacheTime = Date.now();
    return _cachedApy;
  } catch {
    return 0.05;
  }
}
