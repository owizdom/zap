// @ts-nocheck
import { streamText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { getAllZaps } from "@/lib/db";
import { calcYield, calcProtocolFee, formatToken } from "@/lib/yield";
import {
  getEscrowBalance,
  getLiveApy,
  getStakingPosition,
  getActiveStakingTokens,
  getValidatorInfo,
} from "@/lib/escrow";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

async function gatherContext() {
  const [balanceSTRK, balanceETH, balanceUSDC, apy, position, activeTokens, zaps] =
    await Promise.all([
      getEscrowBalance("STRK").catch(() => "unavailable"),
      getEscrowBalance("ETH").catch(() => "unavailable"),
      getEscrowBalance("USDC").catch(() => "unavailable"),
      getLiveApy().catch(() => 0),
      getStakingPosition().catch(() => null),
      getActiveStakingTokens().catch(() => []),
      getAllZaps().catch(() => []),
    ]);

  const validator = getValidatorInfo();

  let totalSent = 0;
  let totalYield = 0;
  const counts = { pending: 0, funded: 0, claimed: 0, refunded: 0 };

  const transfers = zaps.slice(0, 20).map((z) => {
    const zapApy = z.yield_apy ?? 0.05;
    const yieldGross = z.status === "claimed" ? 0n : calcYield(z.amount_raw, z.created_at, zapApy);
    const fee = calcProtocolFee(yieldGross);
    const yieldEarned = yieldGross - fee;
    totalSent += parseFloat(formatToken(BigInt(z.amount_raw), z.token));
    if (z.status !== "claimed") {
      totalYield += parseFloat(formatToken(yieldEarned, z.token));
    }
    counts[z.status as keyof typeof counts]++;
    return `  - ${z.from_email} → ${z.to_email}: ${formatToken(BigInt(z.amount_raw), z.token)} ${z.token} (${z.status})${z.message ? ` "${z.message}"` : ""} [${new Date(z.created_at).toLocaleDateString()}]`;
  });

  return `
## Live On-Chain Data (real-time from Starknet via StarkZap SDK)

### Escrow Wallet Balances
- STRK: ${balanceSTRK}
- ETH: ${balanceETH}
- USDC: ${balanceUSDC}

### Staking Position (${validator.name} validator)
- Staked: ${position?.staked.toFormatted() ?? "0"} STRK
- Rewards: ${position?.rewards.toFormatted() ?? "0"} STRK
- Total: ${position?.total.toFormatted() ?? "0"} STRK
- APY: ${(apy * 100).toFixed(2)}%
- Active staking tokens: ${activeTokens.map((t) => t.symbol).join(", ") || "none"}

### Transfer Summary
- Total transfers: ${zaps.length}
- Total sent: ${totalSent.toFixed(4)} STRK
- Total yield accruing: ${totalYield.toFixed(6)} STRK
- Pending: ${counts.pending} | Funded: ${counts.funded} | Claimed: ${counts.claimed} | Refunded: ${counts.refunded}

### Recent Transfers
${transfers.length > 0 ? transfers.join("\n") : "  No transfers yet."}

### Yield Estimation
At current ${(apy * 100).toFixed(2)}% APY:
- 10 STRK for 30 days → ${(10 * apy * 30 / 365).toFixed(6)} STRK yield
- 100 STRK for 30 days → ${(100 * apy * 30 / 365).toFixed(4)} STRK yield
- 1000 STRK for 30 days → ${(1000 * apy * 30 / 365).toFixed(4)} STRK yield
`;
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  const context = await gatherContext();

  const result = streamText({
    model: groq("llama-3.3-70b-versatile"),
    system: `You are the Zapp AI assistant — a helpful agent for Zapp, an email-native crypto transfer platform on Starknet.

The data below is LIVE — fetched right now from the blockchain via the StarkZap SDK. Use it to answer questions accurately.

${context}

Guidelines:
- Format numbers cleanly (e.g. "826.79 STRK" not "826.795498339782753504")
- Be concise — short, direct answers
- If asked to send/transfer crypto, tell users to go to /send (requires wallet)
- If asked to create a stream, tell users to go to /stream
- If asked about yield estimates for different amounts, calculate using the APY above
- You can do math with the data above to answer custom questions`,
    messages,
  });

  return result.toUIMessageStreamResponse();
}
