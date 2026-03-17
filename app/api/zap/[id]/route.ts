import { NextRequest, NextResponse } from "next/server";
import { getZap } from "@/lib/db";
import { calcYield, calcProtocolFee, formatToken } from "@/lib/yield";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const show = Math.min(3, Math.floor(local.length / 2));
  return `${local.slice(0, show)}***@${domain}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const zap = await getZap(id);

  if (!zap) {
    return NextResponse.json({ error: "Zap not found" }, { status: 404 });
  }

  // Check if caller has the claim secret (from the email link ?s=...)
  const secret = req.nextUrl.searchParams.get("s");
  const authorized = secret === zap.claim_secret;

  const apy = zap.yield_apy ?? 0.05;
  const yieldEarned = zap.status === "claimed" ? 0n : calcYield(zap.amount_raw, zap.created_at, apy);
  const protocolFee = calcProtocolFee(yieldEarned);
  const recipientYield = yieldEarned - protocolFee;
  const totalRaw = BigInt(zap.amount_raw) + recipientYield;

  return NextResponse.json({
    id: zap.id,
    fromEmail: maskEmail(zap.from_email),
    toEmail: maskEmail(zap.to_email),
    amount: formatToken(BigInt(zap.amount_raw), zap.token),
    yieldEarned: formatToken(recipientYield, zap.token),
    protocolFee: formatToken(protocolFee, zap.token),
    total: formatToken(totalRaw, zap.token),
    token: zap.token,
    apy,
    status: zap.status,
    createdAt: zap.created_at,
    claimedAt: zap.claimed_at,
    message: zap.message,
    type: zap.type,
    groupId: zap.group_id,
    lockedUntil: zap.locked_until ?? null,
    // Only authorized recipients can see the claim form
    canClaim: authorized,
  });
}
