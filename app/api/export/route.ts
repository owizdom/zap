import { NextResponse } from "next/server";
import { getAllZaps } from "@/lib/db";
import { calcYield, calcProtocolFee, formatToken } from "@/lib/yield";

export async function GET() {
  const zaps = await getAllZaps();

  const rows = zaps.map((z) => {
    const apy = z.yield_apy ?? 0.05;
    const yieldGross = z.status === "claimed" ? 0n : calcYield(z.amount_raw, z.created_at, apy);
    const protocolFee = calcProtocolFee(yieldGross);
    const yieldNet = yieldGross - protocolFee;
    return [
      z.id,
      z.from_email,
      z.to_email,
      formatToken(BigInt(z.amount_raw), z.token),
      z.token,
      z.status,
      z.type,
      formatToken(yieldNet, z.token),
      formatToken(protocolFee, z.token),
      `${(apy * 100).toFixed(1)}%`,
      new Date(z.created_at).toISOString(),
      z.claimed_at ? new Date(z.claimed_at).toISOString() : "",
      z.tx_hash ?? "",
      z.recipient_address ?? "",
      z.message ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });

  const header = "ID,From,To,Amount,Token,Status,Type,Yield Earned,Protocol Fee,APY,Created At,Claimed At,TX Hash,Recipient Address,Message";
  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="zap-export-${Date.now()}.csv"`,
    },
  });
}
