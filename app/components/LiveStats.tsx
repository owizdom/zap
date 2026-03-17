"use client";

import { useState, useEffect } from "react";

interface Stats {
  transfers: { total: number; claimed: number; pending: number };
  users: { total: number; senders: number; recipients: number };
  volume: Record<string, number>;
  activeStreams: number;
  activeSubscriptions: number;
  activeRecurring: number;
  staking: { staked: string; rewards: string; apy: string; validator: string } | null;
  recent: {
    from: string; to: string; amount: string; token: string;
    status: string; timestamp: number; ago: string; txHash: string | null;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  funded: "#f59e0b",
  pending: "#f59e0b",
  claimed: "#10b981",
  refunded: "#6b7280",
};

export function LiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
    const t = setInterval(() => {
      fetch("/api/stats").then(r => r.json()).then(setStats).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  if (!stats) {
    return (
      <section style={{ display: "flex", justifyContent: "center", gap: 16, padding: "0 24px 80px", flexWrap: "wrap" }}>
        {[
          { label: "Real staking APY", value: "Live yield" },
          { label: "Tokens supported", value: "STRK · ETH · USDC" },
          { label: "Wallet to receive", value: "None needed" },
          { label: "Time to send", value: "< 30 sec" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "22px 28px", textAlign: "center", minWidth: 170 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#6366f1", letterSpacing: "-0.03em" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 5, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </section>
    );
  }

  const volumeStr = Object.entries(stats.volume)
    .map(([token, amount]) => `${amount.toFixed(token === "USDC" ? 2 : 4)} ${token}`)
    .join(" · ") || "0 STRK";

  return (
    <>
      {/* Live counters */}
      <section style={{ display: "flex", justifyContent: "center", gap: 16, padding: "0 24px 40px", flexWrap: "wrap" }}>
        {[
          { label: "Transfers sent", value: String(stats.transfers.total), color: "#6366f1" },
          { label: "Users", value: String(stats.users.total), color: "#6366f1" },
          { label: "Volume", value: volumeStr, color: "#10b981", small: true },
          { label: "Staking APY", value: stats.staking?.apy || "5.0%", color: "#10b981" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "22px 28px", textAlign: "center", minWidth: 170 }}>
            <div style={{ fontSize: s.small ? 14 : 20, fontWeight: 800, color: s.color, letterSpacing: "-0.03em" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 5, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* Additional stats row */}
      <section style={{ display: "flex", justifyContent: "center", gap: 12, padding: "0 24px 40px", flexWrap: "wrap" }}>
        {[
          { label: "Claimed", value: String(stats.transfers.claimed), color: "#10b981" },
          { label: "Pending", value: String(stats.transfers.pending), color: "#f59e0b" },
          { label: "Active streams", value: String(stats.activeStreams), color: "#38bdf8" },
          { label: "Subscriptions", value: String(stats.activeSubscriptions), color: "#8b5cf6" },
          { label: "Recurring", value: String(stats.activeRecurring), color: "#f59e0b" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "14px 20px", textAlign: "center", minWidth: 120 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color, letterSpacing: "-0.03em" }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#4b5563", marginTop: 3, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* Staking position */}
      {stats.staking && (
        <section style={{ display: "flex", justifyContent: "center", padding: "0 24px 40px" }}>
          <div className="card" style={{ padding: "18px 24px", maxWidth: 500, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.04em" }}>Live staking position</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, marginBottom: 2 }}>Staked</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#f0f0f4" }}>{stats.staking.staked}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, marginBottom: 2 }}>Rewards</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>{stats.staking.rewards}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, marginBottom: 2 }}>APY</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>{stats.staking.apy}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, marginBottom: 2 }}>Validator</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#9ca3af" }}>{stats.staking.validator}</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recent activity feed */}
      {stats.recent.length > 0 && (
        <section style={{ padding: "0 24px 80px", maxWidth: 640, margin: "0 auto", width: "100%" }}>
          <h2 style={{ textAlign: "center", fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6, color: "#f0f0f4" }}>
            Recent activity
          </h2>
          <p style={{ textAlign: "center", color: "#4b5563", fontSize: 12, marginBottom: 20 }}>Live transfers on Zapp</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {stats.recent.map((tx, i) => (
              <div key={i} className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: STATUS_COLORS[tx.status] || "#4b5563",
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 600 }}>{tx.from}</span>
                    <span style={{ fontSize: 11, color: "#374151" }}>to</span>
                    <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 600 }}>{tx.to}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#6366f1" }}>{tx.amount} {tx.token}</span>
                    <span style={{ fontSize: 11, color: STATUS_COLORS[tx.status] || "#4b5563", fontWeight: 600, textTransform: "capitalize" }}>
                      {tx.status}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 500 }}>{tx.ago}</div>
                  {tx.txHash && (
                    <a href={`https://sepolia.voyager.online/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, color: "#6366f1", textDecoration: "none" }}>
                      tx {tx.txHash.slice(0, 8)}...
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
