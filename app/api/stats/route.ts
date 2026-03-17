import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";

function getClient() {
  const url = (process.env.TURSO_DATABASE_URL ?? "file:./zap.db").trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  return createClient({ url, authToken });
}

export async function GET() {
  try {
    const db = getClient();

    const [zaps, streams, subscriptions, recurring, staking, apy] = await Promise.all([
      db.execute("SELECT id, from_email, to_email, amount_raw, token, status, created_at, claimed_at, tx_hash, yield_apy FROM zaps ORDER BY created_at DESC"),
      db.execute("SELECT id FROM streams WHERE active = 1"),
      db.execute("SELECT id FROM subscriptions WHERE active = 1"),
      db.execute("SELECT id FROM recurring WHERE active = 1"),
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://zapp-five.vercel.app"}/api/stake`).then(r => r.json()).catch(() => null),
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://zapp-five.vercel.app"}/api/apy`).then(r => r.json()).catch(() => null),
    ]);

    const allZaps = zaps.rows as unknown as {
      id: string; from_email: string; to_email: string;
      amount_raw: string; token: string; status: string;
      created_at: number; claimed_at: number | null;
      tx_hash: string | null; yield_apy: number;
    }[];

    // Aggregate stats
    const totalTransfers = allZaps.length;
    const claimedTransfers = allZaps.filter(z => z.status === "claimed").length;
    const uniqueSenders = new Set(allZaps.map(z => z.from_email)).size;
    const uniqueRecipients = new Set(allZaps.map(z => z.to_email)).size;
    const uniqueUsers = new Set([...allZaps.map(z => z.from_email), ...allZaps.map(z => z.to_email)]).size;

    // Volume by token
    const volume: Record<string, number> = {};
    for (const z of allZaps) {
      const decimals = z.token === "USDC" ? 6 : 18;
      const amount = Number(BigInt(z.amount_raw)) / 10 ** decimals;
      volume[z.token] = (volume[z.token] || 0) + amount;
    }

    // Recent activity (anonymized, last 10)
    const recent = allZaps.slice(0, 10).map(z => {
      const decimals = z.token === "USDC" ? 6 : 18;
      const amount = (Number(BigInt(z.amount_raw)) / 10 ** decimals).toFixed(z.token === "USDC" ? 2 : 4);
      return {
        from: anonymize(z.from_email),
        to: anonymize(z.to_email),
        amount,
        token: z.token,
        status: z.status,
        timestamp: z.created_at,
        ago: timeAgo(z.created_at),
        txHash: z.tx_hash,
      };
    });

    return NextResponse.json({
      transfers: {
        total: totalTransfers,
        claimed: claimedTransfers,
        pending: totalTransfers - claimedTransfers,
      },
      users: {
        total: uniqueUsers,
        senders: uniqueSenders,
        recipients: uniqueRecipients,
      },
      volume,
      activeStreams: (streams.rows as unknown[]).length,
      activeSubscriptions: (subscriptions.rows as unknown[]).length,
      activeRecurring: (recurring.rows as unknown[]).length,
      staking: staking ? {
        staked: staking.staked,
        rewards: staking.rewards,
        apy: apy?.apyPercent || "5.0%",
        validator: staking.validator,
      } : null,
      recent,
    });
  } catch (err) {
    console.error("[stats]", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

function anonymize(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const show = Math.min(3, Math.floor(local.length / 2));
  return `${local.slice(0, show)}***@${domain}`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
