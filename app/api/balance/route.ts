import { NextRequest, NextResponse } from "next/server";
import { getEscrowBalance } from "@/lib/escrow";

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") ?? "STRK";
  try {
    const balance = await getEscrowBalance(token);
    return NextResponse.json({ balance, token });
  } catch {
    return NextResponse.json({ balance: "—", token });
  }
}
