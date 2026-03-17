import { NextRequest, NextResponse } from "next/server";
import { getContacts, getContactHistory, setContactNickname } from "@/lib/db";
import { formatToken } from "@/lib/yield";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  const contact = req.nextUrl.searchParams.get("contact");

  if (!email) {
    return NextResponse.json({ error: "email param required" }, { status: 400 });
  }

  const contacts = await getContacts(email);

  if (contact) {
    // Return history with a specific contact
    const history = await getContactHistory(email, contact);
    return NextResponse.json({ contacts, history });
  }

  return NextResponse.json(contacts);
}

export async function PATCH(req: NextRequest) {
  try {
    const { ownerEmail, contactEmail, nickname } = await req.json() as {
      ownerEmail: string;
      contactEmail: string;
      nickname: string;
    };
    if (!ownerEmail || !contactEmail || !nickname) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    await setContactNickname(ownerEmail, contactEmail, nickname);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/contacts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
