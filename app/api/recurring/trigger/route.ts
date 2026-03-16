/**
 * Internal endpoint — processes due recurring transfers.
 * Called from the dashboard on load and can be set up as a cron.
 */
import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import { getDueRecurring, updateRecurringNext, createZap } from "@/lib/db";
import { sendClaimEmail } from "@/lib/email";
import { formatToken } from "@/lib/yield";
import { getLiveApy } from "@/lib/escrow";

export async function POST() {
  try {
    const due = getDueRecurring();
    const results: string[] = [];

    for (const rec of due) {
      try {
        const apy = await getLiveApy();
        const zapId = uuid();
        const claimSecret = crypto.randomBytes(32).toString("hex");
        const amount = formatToken(BigInt(rec.amount_raw), rec.token);

        createZap({
          id: zapId,
          from_email: rec.from_email,
          to_email: rec.to_email,
          amount_raw: rec.amount_raw,
          token: rec.token,
          claim_secret: claimSecret,
          tx_hash: null,
          created_at: Date.now(),
          message: rec.message,
          type: "send",
          group_id: null,
          yield_apy: apy,
        });

        await sendClaimEmail({
          toEmail: rec.to_email,
          fromEmail: rec.from_email,
          amount,
          token: rec.token,
          zapId,
          message: rec.message,
          apy,
        });

        // Schedule next trigger
        const nextAt = rec.next_at + rec.interval_days * 24 * 60 * 60 * 1000;
        updateRecurringNext(rec.id, nextAt);
        results.push(zapId);
      } catch (err) {
        console.error(`[recurring/trigger] failed for ${rec.id}:`, err);
      }
    }

    return NextResponse.json({ triggered: results.length, zapIds: results });
  } catch (err) {
    console.error("[recurring/trigger]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
