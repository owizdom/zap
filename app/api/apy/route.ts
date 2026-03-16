import { NextResponse } from "next/server";
import { getLiveApy } from "@/lib/escrow";
import { sepoliaValidators } from "starkzap";

export async function GET() {
  const apy = await getLiveApy();
  return NextResponse.json({
    apy,
    apyPercent: `${(apy * 100).toFixed(2)}%`,
    validator: sepoliaValidators.NETHERMIND.name,
  });
}
