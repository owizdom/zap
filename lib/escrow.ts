import {
  StarkZap,
  StarkSigner,
  OnboardStrategy,
  Amount,
  fromAddress,
  sepoliaTokens,
  mainnetTokens,
} from "starkzap";

const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "sepolia") as "sepolia" | "mainnet";

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
    const starkzap = await import("starkzap");
    const validators = NETWORK === "sepolia"
      ? starkzap.sepoliaValidators
      : (starkzap.mainnetValidators ?? starkzap.sepoliaValidators);
    const sdk = getSdk(false);
    let best = 0.05;
    for (const v of Object.values(validators).slice(0, 3)) {
      try {
        // @ts-expect-error SDK staking API
        const pool = await sdk.staking?.getPool?.(v);
        if (pool?.apy && pool.apy > 0) best = Math.max(best, pool.apy);
      } catch { /* skip */ }
    }
    _cachedApy = best;
    _cacheTime = Date.now();
    return best;
  } catch {
    return 0.05;
  }
}
