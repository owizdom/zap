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
import type { PoolMember } from "starkzap";

const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "sepolia") as "sepolia" | "mainnet";

// Use Nethermind on Sepolia (reliable, well-known validator)
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

// ─── Staking ─────────────────────────────────────────────────────────────────

async function getStakingInstance(): Promise<Staking> {
  const sdk = getSdk(false);
  const provider = sdk.getProvider();
  const chainId = NETWORK === "sepolia" ? ChainId.SEPOLIA : ChainId.MAINNET;
  const stakingConfig = getStakingPreset(chainId);
  const tokens = getTokens();
  return Staking.fromStaker(
    VALIDATOR.stakerAddress,
    tokens.STRK,
    provider,
    stakingConfig,
  );
}

/**
 * Stake STRK from the escrow wallet into the validator pool.
 * Uses stake() which auto-selects enter() vs add() based on membership.
 */
export async function stakeEscrow(amountRaw: string): Promise<string> {
  const wallet = await getEscrowWallet(false);
  const tokens = getTokens();
  const staking = await getStakingInstance();
  const amount = Amount.fromRaw(BigInt(amountRaw), tokens.STRK);
  const tx = await staking.stake(wallet, amount);
  await tx.wait();
  return tx.hash;
}

/**
 * Claim accumulated staking rewards to the escrow wallet.
 * Returns the tx hash, or null if there are no rewards or wallet isn't staked.
 */
export async function claimStakingRewards(): Promise<string | null> {
  try {
    const wallet = await getEscrowWallet(false);
    const staking = await getStakingInstance();
    const position = await staking.getPosition(wallet);
    if (!position || position.rewards.isZero()) return null;
    const tx = await staking.claimRewards(wallet);
    await tx.wait();
    return tx.hash;
  } catch (err) {
    console.warn("[staking] claimRewards failed:", String(err));
    return null;
  }
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

// ─── Transfer ────────────────────────────────────────────────────────────────

/**
 * Transfer any supported token from escrow wallet to a recipient.
 * Tries gasless first, falls back to direct (user-paid) if paymaster fails.
 */
export async function releaseToRecipient(
  recipientAddress: string,
  amountStr: string,
  tokenSymbol = "STRK"
): Promise<string> {
  const tokens = getTokens();
  const token = tokens[tokenSymbol as keyof typeof tokens] ?? tokens.STRK;
  const transferArgs = [{ to: fromAddress(recipientAddress), amount: Amount.parse(amountStr, token) }];

  try {
    const wallet = await getEscrowWallet(true); // gasless
    const tx = await wallet.transfer(token, transferArgs);
    await tx.wait();
    return tx.hash;
  } catch (err) {
    if (isPaymasterError(err)) {
      console.warn("[escrow] Paymaster failed, retrying without paymaster:", String(err));
      const wallet = await getEscrowWallet(false); // user-paid fallback
      const tx = await wallet.transfer(token, transferArgs);
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
    // Commission is the validator's cut. Starknet base reward ~5% APY post-commission.
    const commission = await staking.getCommission();
    // Approximate: staker APY = gross_yield * (1 - commission/100)
    // Sepolia gross yield is ~5%; mainnet depends on total stake
    const grossApy = 0.05;
    const netApy = grossApy * (1 - commission / 100);
    _cachedApy = netApy > 0 ? netApy : grossApy;
    _cacheTime = Date.now();
    return _cachedApy;
  } catch {
    return 0.05;
  }
}
