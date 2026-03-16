import { NextRequest, NextResponse } from "next/server";
import { getRequest } from "@/lib/db";
import { formatToken } from "@/lib/yield";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const req = getRequest(id);

  if (!req) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: req.id,
    fromEmail: req.from_email,
    toEmail: req.to_email,
    amount: formatToken(BigInt(req.amount_raw), req.token),
    token: req.token,
    message: req.message,
    status: req.status,
    createdAt: req.created_at,
    paidZapId: req.paid_zap_id,
  });
}
