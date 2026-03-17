import { NextRequest, NextResponse } from "next/server";
import { cancelRecurring, getRecurring } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rec = await getRecurring(id);
  if (!rec) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await cancelRecurring(id);
  return NextResponse.json({ success: true });
}
