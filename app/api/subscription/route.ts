import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { createSubscription, getAllSubscriptions } from "@/lib/db";
import { parseToken } from "@/lib/yield";
import { sendSubscriptionEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { merchantEmail, subscriberEmail, amount, token = "STRK", intervalDays = 30, description } = body as {
      merchantEmail: string;
      subscriberEmail?: string;
      amount: string;
      token?: string;
      intervalDays?: number;
      description?: string;
    };

    if (!merchantEmail || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (parseFloat(amount) <= 0) {
      return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    }

    const normalizedToken = token.toUpperCase();
    const id = uuid();
    const amountRaw = parseToken(amount, normalizedToken).toString();

    createSubscription({
      id,
      merchant_email: merchantEmail,
      amount_raw: amountRaw,
      token: normalizedToken,
      interval_days: intervalDays,
      description: description || null,
      created_at: Date.now(),
    });

    if (subscriberEmail) {
      await sendSubscriptionEmail({
        toEmail: subscriberEmail,
        merchantEmail,
        amount,
        token: normalizedToken,
        intervalDays,
        description: description || null,
        subscriptionId: id,
      });
    }

    return NextResponse.json({ id, subscribeUrl: `/subscribe/${id}` });
  } catch (err) {
    console.error("[POST /api/subscription]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(getAllSubscriptions());
}
