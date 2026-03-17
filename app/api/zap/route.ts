import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import { createZap } from "@/lib/db";
import { sendClaimEmail } from "@/lib/email";
import { parseToken } from "@/lib/yield";
import { getLiveApy, stakeEscrow } from "@/lib/escrow";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fromEmail,
      toEmail,
      amount,
      token = "STRK",
      message,
      txHash,
      type = "send",
      groupId,
    } = body as {
      fromEmail: string;
      toEmail: string;
      amount: string;
      token?: string;
      message?: string;
      txHash?: string;
      type?: string;
      groupId?: string;
      lockDays?: number;
    };

    if (!fromEmail || !toEmail || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    }

    const supportedTokens = ["STRK", "ETH", "USDC"];
    const normalizedToken = token.toUpperCase();
    if (!supportedTokens.includes(normalizedToken)) {
      return NextResponse.json({ error: "Unsupported token" }, { status: 400 });
    }

    const apy = await getLiveApy();
    const id = uuid();
    const claimSecret = crypto.randomBytes(32).toString("hex");
    const amountRaw = parseToken(amount, normalizedToken).toString();
    const now = Date.now();
    const lockedUntil = body.lockDays && body.lockDays > 0
      ? now + body.lockDays * 24 * 60 * 60 * 1000
      : null;

    const zap = await createZap({
      id,
      from_email: fromEmail,
      to_email: toEmail,
      amount_raw: amountRaw,
      token: normalizedToken,
      claim_secret: claimSecret,
      tx_hash: txHash || null,
      created_at: now,
      message: message || null,
      type: type as "send" | "split",
      group_id: groupId || null,
      yield_apy: apy,
      locked_until: lockedUntil,
    });

    await sendClaimEmail({
      toEmail,
      fromEmail,
      amount,
      token: normalizedToken,
      zapId: id,
      claimSecret,
      message,
      apy,
    });

    // Stake deposited STRK into validator pool (fire-and-forget, only STRK is stakeable)
    if (normalizedToken === "STRK" && txHash) {
      stakeEscrow(amountRaw).catch((err) =>
        console.warn("[staking] stake-on-deposit failed:", String(err))
      );
    }

    return NextResponse.json({ id, status: zap.status });
  } catch (err) {
    console.error("[POST /api/zap]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
