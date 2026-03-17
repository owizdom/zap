import { NextRequest, NextResponse } from "next/server";
import { getZap, updateZapStatus } from "@/lib/db";
import { calcYield, calcProtocolFee, formatToken } from "@/lib/yield";
import { releaseToRecipient, claimStakingRewards } from "@/lib/escrow";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const zap = await getZap(id);

    if (!zap) {
      return NextResponse.json({ error: "Zap not found" }, { status: 404 });
    }
    if (zap.status === "claimed") {
      return NextResponse.json({ error: "Already claimed" }, { status: 400 });
    }
    if (zap.status === "refunded") {
      return NextResponse.json({ error: "This zap has been refunded" }, { status: 400 });
    }
    if (zap.locked_until && Date.now() < zap.locked_until) {
      const unlockDate = new Date(zap.locked_until).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return NextResponse.json({ error: `This transfer is locked until ${unlockDate}. Yield is accruing — check back then.` }, { status: 400 });
    }

    const { recipientAddress, secret } = (await req.json()) as { recipientAddress: string; secret?: string };
    if (!secret || secret !== zap.claim_secret) {
      return NextResponse.json({ error: "Unauthorized — invalid claim link" }, { status: 403 });
    }
    if (!recipientAddress || !recipientAddress.startsWith("0x")) {
      return NextResponse.json({ error: "Invalid recipient address" }, { status: 400 });
    }

    // Calculate yield with the APY stored at zap creation
    const apy = zap.yield_apy ?? 0.05;
    const yieldEarned = calcYield(zap.amount_raw, zap.created_at, apy);
    const protocolFee = calcProtocolFee(yieldEarned);
    const recipientYield = yieldEarned - protocolFee;
    const totalRaw = BigInt(zap.amount_raw) + recipientYield;
    const totalStr = formatToken(totalRaw, zap.token);

    // Harvest any accumulated staking rewards back into escrow before releasing
    if (zap.token === "STRK") {
      claimStakingRewards().catch((err) =>
        console.warn("[staking] claimRewards before release failed:", String(err))
      );
    }

    // Mark claimed first to prevent double-claim race
    await updateZapStatus(id, "claimed", {
      recipient_address: recipientAddress,
      claimed_at: Date.now(),
      protocol_fee_raw: protocolFee.toString(),
    });

    let txHash: string;
    try {
      txHash = await releaseToRecipient(recipientAddress, totalStr, zap.token);
    } catch (err) {
      // Revert if transfer fails
      await updateZapStatus(id, "funded");
      console.error("[claim] transfer failed:", err);
      return NextResponse.json({ error: "Transfer failed — please try again" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      txHash,
      amount: formatToken(BigInt(zap.amount_raw), zap.token),
      yieldEarned: formatToken(recipientYield, zap.token),
      protocolFee: formatToken(protocolFee, zap.token),
      total: totalStr,
      token: zap.token,
      apy,
    });
  } catch (err) {
    console.error("[POST /api/zap/[id]/claim]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
