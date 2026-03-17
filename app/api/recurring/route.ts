import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { createRecurring, getAllRecurring } from "@/lib/db";
import { parseToken } from "@/lib/yield";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fromEmail, toEmail, amount, token = "STRK", message, intervalDays = 30 } = body as {
      fromEmail: string;
      toEmail: string;
      amount: string;
      token?: string;
      message?: string;
      intervalDays?: number;
    };

    if (!fromEmail || !toEmail || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    }

    const normalizedToken = token.toUpperCase();
    const id = uuid();
    const amountRaw = parseToken(amount, normalizedToken).toString();
    const nextAt = Date.now() + intervalDays * 24 * 60 * 60 * 1000;

    const rec = await createRecurring({
      id,
      from_email: fromEmail,
      to_email: toEmail,
      amount_raw: amountRaw,
      token: normalizedToken,
      message: message || null,
      interval_days: intervalDays,
      next_at: nextAt,
    });

    return NextResponse.json({ id: rec.id });
  } catch (err) {
    console.error("[POST /api/recurring]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(await getAllRecurring());
}
