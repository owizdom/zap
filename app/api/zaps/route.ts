import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { calcYield, calcProtocolFee, formatToken } from "@/lib/yield";

export async function GET() {
  const db = getDb();
  const zaps = db.prepare("SELECT * FROM zaps ORDER BY created_at DESC").all() as Array<{
    id: string;
    from_email: string;
    to_email: string;
    amount_raw: string;
    token: string;
    tx_hash: string | null;
    status: string;
    created_at: number;
    claimed_at: number | null;
    recipient_address: string | null;
    message: string | null;
    type: string;
    group_id: string | null;
    protocol_fee_raw: string | null;
    yield_apy: number | null;
  }>;

  return NextResponse.json(
    zaps.map((z) => {
      const apy = z.yield_apy ?? 0.05;
      const yieldGross = z.status === "claimed" ? 0n : calcYield(z.amount_raw, z.created_at, apy);
      const protocolFee = calcProtocolFee(yieldGross);
      const yieldEarned = yieldGross - protocolFee;
      const totalRaw = BigInt(z.amount_raw) + yieldEarned;
      return {
        id: z.id,
        fromEmail: z.from_email,
        toEmail: z.to_email,
        amount: formatToken(BigInt(z.amount_raw), z.token),
        yieldEarned: formatToken(yieldEarned, z.token),
        total: formatToken(totalRaw, z.token),
        token: z.token,
        txHash: z.tx_hash,
        status: z.status,
        createdAt: z.created_at,
        claimedAt: z.claimed_at,
        recipientAddress: z.recipient_address,
        message: z.message,
        type: z.type,
        groupId: z.group_id,
        apy,
      };
    })
  );
}
