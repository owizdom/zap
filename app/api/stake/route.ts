import { NextRequest, NextResponse } from "next/server";
import { getStakingPosition, stakeEscrow, claimStakingRewards, getLiveApy } from "@/lib/escrow";

// GET /api/stake — return current staking position + APY
export async function GET() {
  try {
    const [position, apy] = await Promise.all([getStakingPosition(), getLiveApy()]);
    return NextResponse.json({
      staked: position?.staked.toFormatted() ?? "0",
      rewards: position?.rewards.toFormatted() ?? "0",
      total: position?.total.toFormatted() ?? "0",
      unpooling: position?.unpooling.toFormatted() ?? "0",
      unpoolTime: position?.unpoolTime ?? null,
      commissionPercent: position?.commissionPercent ?? null,
      apy,
      apyPercent: `${(apy * 100).toFixed(2)}%`,
    });
  } catch (err) {
    console.error("[GET /api/stake]", err);
    return NextResponse.json({ error: "Failed to fetch staking position" }, { status: 500 });
  }
}

// POST /api/stake — stake a given amount or claim rewards
// body: { action: "stake", amountRaw: "..." } | { action: "claim_rewards" }
export async function POST(req: NextRequest) {
  try {
    const { action, amountRaw } = (await req.json()) as {
      action: "stake" | "claim_rewards";
      amountRaw?: string;
    };

    if (action === "stake") {
      if (!amountRaw) return NextResponse.json({ error: "amountRaw required" }, { status: 400 });
      const txHash = await stakeEscrow(amountRaw);
      return NextResponse.json({ success: true, txHash });
    }

    if (action === "claim_rewards") {
      const txHash = await claimStakingRewards();
      return NextResponse.json({ success: true, txHash: txHash ?? null });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/stake]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
