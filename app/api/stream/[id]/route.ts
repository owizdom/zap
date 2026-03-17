import { NextRequest, NextResponse } from "next/server";
import { getStream } from "@/lib/db";
import { formatToken } from "@/lib/yield";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stream = await getStream(id);
  if (!stream) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  const lastClaimedSec = Math.floor(stream.last_claimed_at / 1000);
  const endSec = Math.floor(stream.end_at / 1000);

  const elapsedSinceLastClaim = Math.min(nowSec - lastClaimedSec, endSec - lastClaimedSec);
  const claimableRaw = elapsedSinceLastClaim > 0
    ? BigInt(stream.amount_per_second_raw) * BigInt(elapsedSinceLastClaim)
    : 0n;

  const totalRaw = BigInt(stream.total_amount_raw);
  const claimedRaw = BigInt(stream.claimed_total_raw);
  const remainingRaw = totalRaw - claimedRaw;
  const actualClaimable = claimableRaw > remainingRaw ? remainingRaw : claimableRaw;

  const progressPct = totalRaw > 0n
    ? Number((claimedRaw * 10000n) / totalRaw) / 100
    : 0;

  const isComplete = stream.active === 0 || claimedRaw >= totalRaw || now >= stream.end_at;

  return NextResponse.json({
    ...stream,
    claimable: formatToken(actualClaimable, stream.token),
    claimableRaw: actualClaimable.toString(),
    claimed: formatToken(claimedRaw, stream.token),
    total: formatToken(totalRaw, stream.token),
    amountPerSecond: formatToken(BigInt(stream.amount_per_second_raw), stream.token),
    progressPct,
    isComplete,
  });
}
