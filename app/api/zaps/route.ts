import { NextResponse } from "next/server";
import { getAllZaps } from "@/lib/db";
import { calcYield, calcProtocolFee, formatToken } from "@/lib/yield";

export async function GET() {
  const zaps = await getAllZaps();

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
