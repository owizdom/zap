import { NextRequest, NextResponse } from "next/server";
import { getRequest, markRequestPaid, createZap } from "@/lib/db";
import { sendClaimEmail, sendRequestPaidEmail } from "@/lib/email";
import { formatToken, parseToken } from "@/lib/yield";
import { getLiveApy } from "@/lib/escrow";
import { v4 as uuid } from "uuid";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const request = getRequest(id);

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (request.status === "paid") {
      return NextResponse.json({ error: "Already paid" }, { status: 400 });
    }
    if (request.status === "cancelled") {
      return NextResponse.json({ error: "This request was cancelled" }, { status: 400 });
    }

    const { txHash } = (await req.json()) as { txHash?: string };

    const apy = await getLiveApy();
    const zapId = uuid();
    const claimSecret = crypto.randomBytes(32).toString("hex");
    const amount = formatToken(BigInt(request.amount_raw), request.token);

    createZap({
      id: zapId,
      from_email: request.to_email, // payer is the sender
      to_email: request.from_email, // requester is the recipient
      amount_raw: request.amount_raw,
      token: request.token,
      claim_secret: claimSecret,
      tx_hash: txHash || null,
      created_at: Date.now(),
      message: request.message,
      type: "request",
      group_id: null,
      yield_apy: apy,
    });

    markRequestPaid(id, zapId);

    // Notify requester they can now claim
    await sendClaimEmail({
      toEmail: request.from_email,
      fromEmail: request.to_email,
      amount,
      token: request.token,
      zapId,
      message: request.message,
      apy,
    });

    return NextResponse.json({ success: true, zapId });
  } catch (err) {
    console.error("[POST /api/request/[id]/pay]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
