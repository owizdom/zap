// Protocol fee: 10% of yield goes to Zap
export const PROTOCOL_FEE_BPS = 1000;
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

// Token decimals
const TOKEN_DECIMALS: Record<string, number> = {
  STRK: 18,
  ETH: 18,
  USDC: 6,
};

export function getTokenDecimals(token: string): number {
  return TOKEN_DECIMALS[token.toUpperCase()] ?? 18;
}

/**
 * Calculate yield earned since the zap was created.
 * Uses real APY stored at zap creation time (from validators), falls back to 5%.
 */
export function calcYield(amountRaw: string, createdAt: number, apy = 0.05): bigint {
  const now = Date.now();
  const elapsedSeconds = (now - createdAt) / 1000;
  const amount = BigInt(amountRaw);
  const yieldRaw =
    (amount * BigInt(Math.floor(apy * elapsedSeconds * 1e9))) /
    BigInt(SECONDS_PER_YEAR) /
    BigInt(1e9);
  return yieldRaw;
}

/** 10% of yield is kept as protocol fee */
export function calcProtocolFee(yieldRaw: bigint): bigint {
  return (yieldRaw * BigInt(PROTOCOL_FEE_BPS)) / 10000n;
}

/** Format raw bigint to human-readable string for any token */
export function formatToken(raw: bigint, token: string): string {
  const decimals = getTokenDecimals(token);
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  const displayDecimals = token.toUpperCase() === "USDC" ? 4 : 6;
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, displayDecimals);
  return `${whole}.${fractionStr}`;
}

/** Parse human-readable amount string to raw bigint for any token */
export function parseToken(amount: string, token: string): bigint {
  const decimals = getTokenDecimals(token);
  const [whole, fraction = ""] = amount.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFraction);
}

// Backwards compat aliases
export function formatSTRK(raw: bigint): string {
  return formatToken(raw, "STRK");
}

export function parseSTRK(amount: string): bigint {
  return parseToken(amount, "STRK");
}
