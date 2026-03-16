import { NextRequest, NextResponse } from "next/server";
import { getZap } from "@/lib/db";
import { sendClaimEmail } from "@/lib/email";
import { formatToken } from "@/lib/yield";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const zap = getZap(id);

    if (!zap) {
      return NextResponse.json({ error: "Zap not found" }, { status: 404 });
    }
    if (zap.status === "claimed") {
      return NextResponse.json({ error: "Already claimed" }, { status: 400 });
    }
    if (zap.status === "refunded") {
      return NextResponse.json({ error: "Already refunded" }, { status: 400 });
    }

    await sendClaimEmail({
      toEmail: zap.to_email,
      fromEmail: zap.from_email,
      amount: formatToken(BigInt(zap.amount_raw), zap.token),
      token: zap.token,
      zapId: zap.id,
      message: zap.message,
      apy: zap.yield_apy,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/zap/[id]/resend]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
