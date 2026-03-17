import {
  StarkZap,
  StarkSigner,
  PrivySigner,
  OnboardStrategy,
  Amount,
  fromAddress,
  sepoliaTokens,
  mainnetTokens,
  getPresets,
  Staking,
  sepoliaValidators,
  ChainId,
  getStakingPreset,
  ArgentXV050Preset,
  accountPresets,
} from "starkzap";
import type { PoolMember, Token, FeeMode, PrivySignerConfig } from "starkzap";

const NETWORK = ((process.env.NEXT_PUBLIC_NETWORK || "sepolia").trim()) as "sepolia" | "mainnet";

// Nethermind — reliable validator on Sepolia and Mainnet
const VALIDATOR = sepoliaValidators.NETHERMIND;

function getChainId(): ChainId {
  return NETWORK === "sepolia" ? ChainId.SEPOLIA : ChainId.MAINNET;
}

function getSdk(feeMode: FeeMode = "user_pays") {
  return new StarkZap({
    network: NETWORK,
    ...(feeMode === "sponsored" && { paymaster: { nodeUrl: "https://starknet.paymaster.avnu.fi" } }),
  });
}

/** @deprecated Use getSdk(feeMode) instead */
function getSdkLegacy(withPaymaster = true) {
  return getSdk(withPaymaster ? "sponsored" : "user_pays");
}

export function getTokens() {
  return NETWORK === "sepolia" ? sepoliaTokens : mainnetTokens;
}

/**
 * Dynamically discover all available token presets for the current chain.
 * Returns a record of symbol -> Token, including tokens not in the hardcoded
 * sepoliaTokens/mainnetTokens constants.
 */
export function getAvailableTokenPresets(): Record<string, Token> {
  return getPresets(getChainId());
}

/**
 * Returns all available account presets (wallet types).
 * Useful for displaying wallet selection UI.
 */
export function getAvailableAccountPresets() {
  return {
    presets: accountPresets,
    recommended: {
      privy: ArgentXV050Preset,
      description: "ArgentX v0.5.0 — used by Privy for Starknet wallets",
    },
  };
}

export async function getEscrowWallet(withPaymaster = true) {
  const privateKey = process.env.ESCROW_PRIVATE_KEY?.trim();
  if (!privateKey) throw new Error("ESCROW_PRIVATE_KEY not set");
  const { wallet } = await getSdkLegacy(withPaymaster).onboard({
    strategy: OnboardStrategy.Signer,
    account: { signer: new StarkSigner(privateKey) },
    deploy: "if_needed",
  });
  return wallet;
}

/**
 * Create a Privy-managed wallet via the SDK onboard flow.
 * Used server-side to sign transactions on behalf of Privy users.
 */
export async function getPrivyWallet(config: PrivySignerConfig, feeMode: FeeMode = "sponsored") {
  const sdk = getSdk(feeMode);
  const { wallet } = await sdk.onboard({
    strategy: OnboardStrategy.Privy,
    privy: {
      resolve: async () => ({
        walletId: config.walletId,
        publicKey: config.publicKey,
        serverUrl: config.serverUrl,
        rawSign: config.rawSign,
        headers: config.headers,
        buildBody: config.buildBody,
        requestTimeoutMs: config.requestTimeoutMs,
      }),
    },
    accountPreset: ArgentXV050Preset,
    feeMode,
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

// ─── Fee estimation ──────────────────────────────────────────────────────────

/**
 * Estimate the transaction fee for a transfer.
 * Returns the estimated fee in human-readable format and the fee mode used.
 */
export async function estimateTransferFee(
  recipientAddress: string,
  amountStr: string,
  tokenSymbol = "STRK",
  feeMode: FeeMode = "sponsored"
): Promise<{ estimatedFee: string; feeToken: string; feeMode: FeeMode }> {
  const tokens = getTokens();
  const token = tokens[tokenSymbol as keyof typeof tokens] ?? tokens.STRK;

  if (feeMode === "sponsored") {
    return { estimatedFee: "0", feeToken: "STRK", feeMode: "sponsored" };
  }

  try {
    const wallet = await getEscrowWallet(false);
    const { cairo } = await import("starknet");
    const amountRaw = Amount.parse(amountStr, token);
    const amount256 = cairo.uint256(amountRaw.toBase());

    const fee = await wallet.estimateFee([{
      contractAddress: token.address as string,
      entrypoint: "transfer",
      calldata: [recipientAddress, amount256.low.toString(), amount256.high.toString()],
    }]);

    const feeWei = BigInt(fee.overall_fee.toString());
    const feeFormatted = (Number(feeWei) / 1e18).toFixed(8);

    return { estimatedFee: feeFormatted, feeToken: "ETH", feeMode: "user_pays" };
  } catch {
    return { estimatedFee: "~0.0001", feeToken: "ETH", feeMode: "user_pays" };
  }
}

// ─── Staking helpers ──────────────────────────────────────────────────────────

function getStakingDeps() {
  const sdk = getSdkLegacy(false);
  const provider = sdk.getProvider();
  const chainId = getChainId();
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
