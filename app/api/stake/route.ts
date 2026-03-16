import { NextRequest, NextResponse } from "next/server";
import {
  getStakingPosition,
  stakeEscrow,
  claimStakingRewards,
  exitIntentFromPool,
  exitFromPool,
  getActiveStakingTokens,
  getLiveApy,
  getValidatorInfo,
} from "@/lib/escrow";

// GET /api/stake — live staking position, APY, active tokens
export async function GET() {
  try {
    const [position, apy, activeTokens] = await Promise.all([
      getStakingPosition(),
      getLiveApy(),
      getActiveStakingTokens(),
    ]);

    const validator = getValidatorInfo();

    return NextResponse.json({
      validator: {
        name: validator.name,
        address: validator.stakerAddress,
      },
      staked:      position?.staked.toFormatted()    ?? "0",
      rewards:     position?.rewards.toFormatted()   ?? "0",
      total:       position?.total.toFormatted()     ?? "0",
      unpooling:   position?.unpooling.toFormatted() ?? "0",
      unpoolTime:  position?.unpoolTime              ?? null,
      commission:  position?.commissionPercent       ?? null,
      apy,
      apyPercent:  `${(apy * 100).toFixed(2)}%`,
      activeTokens: activeTokens.map((t) => ({ symbol: t.symbol, address: t.address })),
    });
  } catch (err) {
    console.error("[GET /api/stake]", err);
    return NextResponse.json({ error: "Failed to fetch staking position" }, { status: 500 });
  }
}

// POST /api/stake
// { action: "stake",        amountRaw: "..." }
// { action: "claim_rewards"                  }
// { action: "exit_intent",  amountRaw: "..." }
// { action: "exit"                           }
export async function POST(req: NextRequest) {
  try {
    const { action, amountRaw } = (await req.json()) as {
      action: "stake" | "claim_rewards" | "exit_intent" | "exit";
      amountRaw?: string;
    };

    if (action === "stake") {
      if (!amountRaw) return NextResponse.json({ error: "amountRaw required" }, { status: 400 });
      const txHash = await stakeEscrow(amountRaw);
      return NextResponse.json({ success: true, action, txHash });
    }

    if (action === "claim_rewards") {
      const txHash = await claimStakingRewards();
      return NextResponse.json({ success: true, action, txHash: txHash ?? null });
    }

    if (action === "exit_intent") {
      if (!amountRaw) return NextResponse.json({ error: "amountRaw required" }, { status: 400 });
      const txHash = await exitIntentFromPool(amountRaw);
      return NextResponse.json({ success: true, action, txHash });
    }

    if (action === "exit") {
      const txHash = await exitFromPool();
      return NextResponse.json({ success: true, action, txHash });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/stake]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
