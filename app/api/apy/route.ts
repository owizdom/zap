import { NextResponse } from "next/server";
import { getLiveApy } from "@/lib/escrow";

export async function GET() {
  const apy = await getLiveApy();
  return NextResponse.json({ apy, apyPercent: `${(apy * 100).toFixed(1)}%` });
}
