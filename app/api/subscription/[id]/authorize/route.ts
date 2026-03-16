import { NextRequest, NextResponse } from "next/server";
import { getSubscription, authorizeSubscription } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { subscriberEmail } = await req.json() as { subscriberEmail: string };
    if (!subscriberEmail) {
      return NextResponse.json({ error: "subscriberEmail required" }, { status: 400 });
    }

    const sub = getSubscription(id);
    if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    if (sub.active) return NextResponse.json({ error: "Already authorized" }, { status: 400 });

    const now = Date.now();
    const nextPullAt = now + sub.interval_days * 86400 * 1000;
    authorizeSubscription(id, subscriberEmail, now, nextPullAt);

    return NextResponse.json({ success: true, nextPullAt });
  } catch (err) {
    console.error("[POST /api/subscription/[id]/authorize]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
