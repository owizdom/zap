import { NextRequest, NextResponse } from "next/server";
import { getSubscription, updateSubscriptionNextPull, cancelSubscription } from "@/lib/db";
import { formatToken } from "@/lib/yield";
import { releaseToRecipient } from "@/lib/escrow";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { recipientAddress } = await req.json() as { recipientAddress: string };
    if (!recipientAddress?.startsWith("0x")) {
      return NextResponse.json({ error: "Invalid recipient address" }, { status: 400 });
    }

    const sub = getSubscription(id);
    if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!sub.active) return NextResponse.json({ error: "Subscription not active" }, { status: 400 });
    if (!sub.next_pull_at || Date.now() < sub.next_pull_at) {
      return NextResponse.json({ error: "Not due yet", nextPullAt: sub.next_pull_at }, { status: 400 });
    }

    const amount = formatToken(BigInt(sub.amount_raw), sub.token);
    const txHash = await releaseToRecipient(recipientAddress, amount, sub.token);

    const nextPullAt = Date.now() + sub.interval_days * 86400 * 1000;
    updateSubscriptionNextPull(id, nextPullAt);

    return NextResponse.json({ success: true, txHash, amount, token: sub.token, nextPullAt });
  } catch (err) {
    console.error("[POST /api/subscription/[id]/collect]", err);
    return NextResponse.json({ error: "Collect failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  cancelSubscription(id);
  return NextResponse.json({ success: true });
}
