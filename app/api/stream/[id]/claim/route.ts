import { NextRequest, NextResponse } from "next/server";
import { getStream, updateStreamClaimed, deactivateStream } from "@/lib/db";
import { formatToken } from "@/lib/yield";
import { releaseToRecipient } from "@/lib/escrow";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const { recipientAddress } = await req.json() as { recipientAddress: string };
    if (!recipientAddress?.startsWith("0x")) {
      return NextResponse.json({ error: "Invalid recipient address" }, { status: 400 });
    }

    const stream = await getStream(id);
    if (!stream) return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    if (!stream.active) return NextResponse.json({ error: "Stream is no longer active" }, { status: 400 });

    const now = Date.now();
    const nowSec = Math.floor(now / 1000);
    const lastClaimedSec = Math.floor(stream.last_claimed_at / 1000);
    const endSec = Math.floor(stream.end_at / 1000);

    const elapsed = Math.min(nowSec - lastClaimedSec, endSec - lastClaimedSec);
    if (elapsed <= 0) {
      return NextResponse.json({ error: "Nothing to claim yet" }, { status: 400 });
    }

    const claimableRaw = BigInt(stream.amount_per_second_raw) * BigInt(elapsed);
    const totalRaw = BigInt(stream.total_amount_raw);
    const claimedSoFar = BigInt(stream.claimed_total_raw);
    const remaining = totalRaw - claimedSoFar;
    const actualRaw = claimableRaw > remaining ? remaining : claimableRaw;

    if (actualRaw <= 0n) {
      return NextResponse.json({ error: "Nothing to claim" }, { status: 400 });
    }

    const claimAmount = formatToken(actualRaw, stream.token);
    const txHash = await releaseToRecipient(recipientAddress, claimAmount, stream.token);

    const newClaimedTotal = (claimedSoFar + actualRaw).toString();
    await updateStreamClaimed(id, now, newClaimedTotal);

    const isDone = claimedSoFar + actualRaw >= totalRaw || now >= stream.end_at;
    if (isDone) await deactivateStream(id);

    return NextResponse.json({
      success: true,
      txHash,
      claimed: claimAmount,
      token: stream.token,
      streamDone: isDone,
    });
  } catch (err) {
    console.error("[POST /api/stream/[id]/claim]", err);
    return NextResponse.json({ error: "Claim failed" }, { status: 500 });
  }
}
