import { NextRequest, NextResponse } from "next/server";
import { getSubscription } from "@/lib/db";
import { formatToken } from "@/lib/yield";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sub = await getSubscription(id);
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...sub,
    amount: formatToken(BigInt(sub.amount_raw), sub.token),
  });
}
