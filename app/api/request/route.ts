import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { createRequest, getDb } from "@/lib/db";
import { sendRequestEmail } from "@/lib/email";
import { parseToken } from "@/lib/yield";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fromEmail, toEmail, amount, token = "STRK", message } = body as {
      fromEmail: string;
      toEmail?: string;
      amount: string;
      token?: string;
      message?: string;
    };

    if (!fromEmail || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    }

    const normalizedToken = token.toUpperCase();
    const id = uuid();
    const amountRaw = parseToken(amount, normalizedToken).toString();

    createRequest({
      id,
      from_email: fromEmail,
      to_email: toEmail || "",
      amount_raw: amountRaw,
      token: normalizedToken,
      message: message || null,
      created_at: Date.now(),
    });

    if (toEmail) {
      await sendRequestEmail({ toEmail, fromEmail, amount, token: normalizedToken, requestId: id, message });
    }

    return NextResponse.json({ id, payUrl: `/pay/${id}` });
  } catch (err) {
    console.error("[POST /api/request]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  const db = getDb();
  const requests = db.prepare("SELECT * FROM requests ORDER BY created_at DESC").all();
  return NextResponse.json(requests);
}
