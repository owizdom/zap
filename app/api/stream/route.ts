import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { createStream, getAllStreams } from "@/lib/db";
import { parseToken } from "@/lib/yield";
import { sendStreamEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fromEmail, toEmail, totalAmount, token = "STRK", durationDays, message } = body as {
      fromEmail: string;
      toEmail: string;
      totalAmount: string;
      token?: string;
      durationDays: number;
      message?: string;
    };

    if (!fromEmail || !toEmail || !totalAmount || !durationDays) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (parseFloat(totalAmount) <= 0) {
      return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    }
    if (durationDays < 1) {
      return NextResponse.json({ error: "Duration must be at least 1 day" }, { status: 400 });
    }

    const normalizedToken = token.toUpperCase();
    const id = uuid();
    const totalRaw = parseToken(totalAmount, normalizedToken);
    const now = Date.now();
    const startAt = now;
    const endAt = now + durationDays * 86400 * 1000;
    const durationSeconds = durationDays * 86400;
    const amountPerSecondRaw = totalRaw / BigInt(durationSeconds);

    const stream = createStream({
      id,
      from_email: fromEmail,
      to_email: toEmail,
      amount_per_second_raw: amountPerSecondRaw.toString(),
      total_amount_raw: totalRaw.toString(),
      token: normalizedToken,
      start_at: startAt,
      end_at: endAt,
      last_claimed_at: startAt,
      message: message || null,
      created_at: now,
    });

    // Format per-second for email display
    const decimals = normalizedToken === "USDC" ? 6 : 18;
    const divisor = 10n ** BigInt(decimals);
    const perSecDisplay = Number(amountPerSecondRaw * 10000n / divisor) / 10000;

    await sendStreamEmail({
      toEmail,
      fromEmail,
      amountPerSecond: perSecDisplay.toFixed(8),
      total: totalAmount,
      token: normalizedToken,
      durationDays,
      streamId: id,
      message: message || null,
    });

    return NextResponse.json({ id: stream.id });
  } catch (err) {
    console.error("[POST /api/stream]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  const streams = getAllStreams();
  return NextResponse.json(streams);
}
