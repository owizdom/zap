"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Zap {
  id: string;
  fromEmail: string;
  toEmail: string;
  amount: string;
  yieldEarned: string;
  total: string;
  token: string;
  txHash: string | null;
  status: "pending" | "funded" | "claimed" | "refunded";
  createdAt: number;
  claimedAt: number | null;
  recipientAddress: string | null;
  message: string | null;
  type: string;
  apy: number;
}

interface Recurring {
  id: string;
  from_email: string;
  to_email: string;
  amount_raw: string;
  token: string;
  message: string | null;
  interval_days: number;
  next_at: number;
  active: number;
}

interface Stream {
  id: string;
  from_email: string;
  to_email: string;
  total_amount_raw: string;
  token: string;
  start_at: number;
  end_at: number;
  last_claimed_at: number;
  claimed_total_raw: string;
  active: number;
  message: string | null;
  created_at: number;
}

interface Subscription {
  id: string;
  merchant_email: string;
  subscriber_email: string | null;
  amount_raw: string;
  token: string;
  interval_days: number;
  description: string | null;
  next_pull_at: number | null;
  active: number;
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: "Pending",  color: "#f59e0b", bg: "#1a1100" },
  funded:   { label: "Waiting",  color: "#6366f1", bg: "#0d0d1f" },
  claimed:  { label: "Claimed",  color: "#10b981", bg: "#0a150a" },
  refunded: { label: "Refunded", color: "#6b7280", bg: "#111" },
};

const TOKEN_COLOR: Record<string, string> = { STRK: "#6366f1", ETH: "#64748b", USDC: "#2563eb" };

function timeAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function timeUntil(ms: number): string {
  const s = Math.floor((ms - Date.now()) / 1000);
  if (s < 0) return "Due now";
  if (s < 3600) return `in ${Math.floor(s / 60)}m`;
  if (s < 86400) return `in ${Math.floor(s / 3600)}h`;
  return `in ${Math.floor(s / 86400)}d`;
}

function short(addr: string): string {
  return addr.slice(0, 8) + "..." + addr.slice(-6);
}

export default function DashboardPage() {
  const [zaps, setZaps] = useState<Zap[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "funded" | "claimed" | "refunded">("all");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [escrowBalance, setEscrowBalance] = useState<string | null>(null);
  const [tab, setTab] = useState<"transfers" | "recurring" | "streams" | "subscriptions">("transfers");

  const load = useCallback(async () => {
    const [zapsRes, recurRes, streamRes, subRes] = await Promise.all([
      fetch("/api/zaps"),
      fetch("/api/recurring"),
      fetch("/api/stream"),
      fetch("/api/subscription"),
    ]);
    if (zapsRes.ok) setZaps(await zapsRes.json());
    if (recurRes.ok) setRecurring(await recurRes.json());
    if (streamRes.ok) setStreams(await streamRes.json());
    if (subRes.ok) setSubscriptions(await subRes.json());
    setLoading(false);
  }, []);

  const loadBalance = useCallback(async () => {
    const res = await fetch("/api/balance");
    if (res.ok) {
      const data = await res.json() as { balance: string };
      setEscrowBalance(data.balance);
    }
  }, []);

  const triggerRecurring = useCallback(async () => {
    await fetch("/api/recurring/trigger", { method: "POST" });
  }, []);

  useEffect(() => {
    Promise.all([load(), loadBalance(), triggerRecurring()]);
    const t = setInterval(load, 5000);
    const t2 = setInterval(loadBalance, 30000);
    return () => { clearInterval(t); clearInterval(t2); };
  }, [load, loadBalance, triggerRecurring]);

  const filtered = zaps.filter((z) => {
    if (filter !== "all" && z.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return z.fromEmail.toLowerCase().includes(q) || z.toEmail.toLowerCase().includes(q) || z.id.includes(q);
    }
    return true;
  });

  const totalSent = zaps.reduce((s, z) => s + parseFloat(z.amount), 0);
  const totalYield = zaps.filter((z) => z.status !== "claimed").reduce((s, z) => s + parseFloat(z.yieldEarned), 0);
  const claimedCount = zaps.filter((z) => z.status === "claimed").length;
  const pendingCount = zaps.filter((z) => z.status === "funded" || z.status === "pending").length;
  const activeRecurring = recurring.filter((r) => r.active);
  const activeStreams = streams.filter((s) => s.active);
  const activeSubs = subscriptions.filter((s) => s.active);

  function copyLink(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/claim/${id}`);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function resendEmail(id: string) {
    setResending(id);
    try {
      await fetch(`/api/zap/${id}/resend`, { method: "POST" });
    } finally {
      setTimeout(() => setResending(null), 1500);
    }
  }

  async function cancelRecurring(id: string) {
    await fetch(`/api/recurring/${id}`, { method: "DELETE" });
    load();
  }

  function exportCsv() {
    window.open("/api/export", "_blank");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#080810" }}>
      {/* Nav */}
      <nav style={{ padding: "0 32px", height: 56, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1e35", background: "#080810", position: "sticky", top: 0, zIndex: 10 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#f0f0f4" }}>
          <span className="logo-mark">Z</span>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>Zapp</span>
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {escrowBalance !== null && (
            <div style={{ background: "#0f0f1a", border: "1px solid #1e1e35", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>
              Escrow: <span style={{ color: "#6366f1" }}>{escrowBalance} STRK</span>
            </div>
          )}
          <button onClick={exportCsv} className="btn-secondary" style={{ fontSize: 12 }}>Export CSV</button>
          <button onClick={() => { load(); loadBalance(); }} className="btn-secondary" style={{ fontSize: 12 }}>Refresh</button>
          <Link href="/contacts" style={{ background: "#0f0f1a", color: "#9ca3af", fontWeight: 600, padding: "7px 14px", borderRadius: 8, textDecoration: "none", fontSize: 13, border: "1px solid #1e1e35" }}>
            Contacts
          </Link>
          <Link href="/request" style={{ background: "#0f0f1a", color: "#f59e0b", fontWeight: 600, padding: "7px 14px", borderRadius: 8, textDecoration: "none", fontSize: 13, border: "1px solid #3a2800" }}>
            Request
          </Link>
          <Link href="/stream" style={{ background: "#0f0f1a", color: "#38bdf8", fontWeight: 600, padding: "7px 14px", borderRadius: 8, textDecoration: "none", fontSize: 13, border: "1px solid #1a3a60" }}>
            Stream
          </Link>
          <Link href="/send" style={{ background: "#6366f1", color: "#fff", fontWeight: 600, padding: "7px 16px", borderRadius: 8, textDecoration: "none", fontSize: 14 }}>
            Send
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>Dashboard</h1>
          <p style={{ color: "#6b7280", fontSize: 13 }}>All transfers · Yield updates every 5 seconds</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Total sent",      value: totalSent.toFixed(4) + " STRK",                        green: false, purple: false },
            { label: "Yield accruing",  value: "+" + totalYield.toFixed(8) + " STRK",                 green: true,  purple: false },
            { label: "Claimed",         value: `${claimedCount} transfer${claimedCount !== 1 ? "s" : ""}`, green: true, purple: false },
            { label: "Awaiting claim",  value: `${pendingCount} transfer${pendingCount !== 1 ? "s" : ""}`, green: false, purple: true },
            { label: "Recurring",       value: `${activeRecurring.length} active`,                    green: false, purple: false },
            { label: "Streams",         value: `${activeStreams.length} active`,                       green: false, purple: false },
            { label: "Subscriptions",   value: `${activeSubs.length} active`,                          green: false, purple: false },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div style={{ fontSize: 18, fontWeight: 800, color: s.green ? "#10b981" : s.purple ? "#6366f1" : "#f0f0f4", letterSpacing: "-0.03em", lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #1e1e35", flexWrap: "wrap" }}>
          {([
            { key: "transfers",     label: "Transfers",     badge: pendingCount },
            { key: "recurring",     label: "Recurring",     badge: activeRecurring.length },
            { key: "streams",       label: "Streams",       badge: activeStreams.length },
            { key: "subscriptions", label: "Subscriptions", badge: activeSubs.length },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent", border: "none", borderBottom: `2px solid ${tab === t.key ? "#6366f1" : "transparent"}`, color: tab === t.key ? "#f0f0f4" : "#4b5563", marginBottom: -1 }}>
              {t.label}
              {t.badge > 0 && (
                <span style={{ background: "#6366f1", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "1px 6px", marginLeft: 6 }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Transfers tab */}
        {tab === "transfers" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <input type="text" placeholder="Search by email or ID..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input" style={{ flex: 1, minWidth: 220 }} />
              <div style={{ display: "flex", gap: 6 }}>
                {(["all", "funded", "claimed", "pending", "refunded"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 600, border: "none", background: filter === f ? "#6366f1" : "#161625", color: filter === f ? "#fff" : "#6b7280" }}>
                    {f === "all" ? `All (${zaps.length})` : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: "#4b5563", fontSize: 14 }}>Loading transfers...</div>
            ) : filtered.length === 0 ? (
              <div className="card" style={{ padding: 60, textAlign: "center" }}>
                <div style={{ color: "#4b5563", fontSize: 14, marginBottom: zaps.length === 0 ? 20 : 0 }}>
                  {zaps.length === 0 ? "No transfers yet" : "No matches"}
                </div>
                {zaps.length === 0 && (
                  <Link href="/send" style={{ background: "#6366f1", color: "#fff", fontWeight: 700, padding: "11px 22px", borderRadius: 9, textDecoration: "none", fontSize: 14 }}>
                    Send your first transfer
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filtered.map((zap) => {
                  const st = STATUS[zap.status] || STATUS.pending;
                  const tokenColor = TOKEN_COLOR[zap.token] ?? "#6366f1";
                  return (
                    <div key={zap.id} className="card" style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                        {/* Left */}
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span className="badge" style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}30` }}>
                              <span className="badge-dot" style={{ background: st.color }} />
                              {st.label}
                            </span>
                            {zap.type === "split" && (
                              <span className="badge" style={{ background: "#0d0d1f", color: "#6366f1", border: "1px solid #6366f130" }}>Split</span>
                            )}
                            {zap.type === "request" && (
                              <span className="badge" style={{ background: "#1a1400", color: "#f59e0b", border: "1px solid #f59e0b30" }}>Request</span>
                            )}
                            <span style={{ color: "#4b5563", fontSize: 12 }}>{timeAgo(zap.createdAt)}</span>
                          </div>
                          <div style={{ fontSize: 14, color: "#9ca3af" }}>
                            <span style={{ color: "#f0f0f4", fontWeight: 600 }}>{zap.fromEmail}</span>
                            <span style={{ margin: "0 8px", color: "#374151" }}>→</span>
                            <span style={{ color: "#f0f0f4", fontWeight: 600 }}>{zap.toEmail}</span>
                          </div>
                          {zap.message && (
                            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 5, fontStyle: "italic" }}>
                              &ldquo;{zap.message}&rdquo;
                            </div>
                          )}
                          {zap.recipientAddress && (
                            <div style={{ fontSize: 11, color: "#374151", marginTop: 4, fontFamily: "monospace" }}>
                              Claimed by: {short(zap.recipientAddress)}
                            </div>
                          )}
                        </div>

                        {/* Amounts */}
                        <div style={{ textAlign: "right", minWidth: 150 }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "#f0f0f4", letterSpacing: "-0.03em", lineHeight: 1 }}>
                            {zap.amount} <span style={{ color: tokenColor, fontSize: 13 }}>{zap.token}</span>
                          </div>
                          {zap.status !== "claimed" && parseFloat(zap.yieldEarned) > 0 && (
                            <div style={{ fontSize: 12, color: "#10b981", marginTop: 4, fontWeight: 600 }}>
                              +{zap.yieldEarned} yield ({(zap.apy * 100).toFixed(1)}%)
                            </div>
                          )}
                          {zap.claimedAt && (
                            <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>
                              Claimed {timeAgo(zap.claimedAt)}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
                          {(zap.status === "pending" || zap.status === "funded") && (
                            <>
                              <button onClick={() => copyLink(zap.id)} className="btn-secondary"
                                style={{ fontSize: 12, color: copied === zap.id ? "#10b981" : undefined }}>
                                {copied === zap.id ? "Copied" : "Copy link"}
                              </button>
                              <button onClick={() => resendEmail(zap.id)} className="btn-secondary"
                                style={{ fontSize: 12, color: resending === zap.id ? "#10b981" : undefined }}
                                disabled={resending === zap.id}>
                                {resending === zap.id ? "Sent ✓" : "Resend email"}
                              </button>
                            </>
                          )}
                          {zap.txHash && (
                            <a href={`https://sepolia.starkscan.co/tx/${zap.txHash}`} target="_blank" rel="noopener noreferrer"
                              className="btn-secondary" style={{ fontSize: 12, color: "#6366f1" }}>
                              Tx →
                            </a>
                          )}
                        </div>
                      </div>

                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e1e35", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#2a2a4a" }}>{zap.id}</span>
                        <Link href={`/claim/${zap.id}`} style={{ fontSize: 12, color: "#4b5563", textDecoration: "none" }}>
                          View claim page →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Streams tab */}
        {tab === "streams" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Salary streams drip tokens per second.</p>
              <Link href="/stream" style={{ background: "#0ea5e9", color: "#fff", fontWeight: 600, padding: "7px 16px", borderRadius: 8, textDecoration: "none", fontSize: 13 }}>
                New stream
              </Link>
            </div>
            {streams.length === 0 ? (
              <div className="card" style={{ padding: 60, textAlign: "center" }}>
                <div style={{ color: "#4b5563", fontSize: 14, marginBottom: 20 }}>No salary streams yet</div>
                <Link href="/stream" style={{ background: "#0ea5e9", color: "#fff", fontWeight: 700, padding: "11px 22px", borderRadius: 9, textDecoration: "none", fontSize: 14 }}>
                  Start a stream
                </Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {streams.map((s) => {
                  const totalRaw = BigInt(s.total_amount_raw);
                  const claimedRaw = BigInt(s.claimed_total_raw);
                  const pct = totalRaw > 0n ? Number(claimedRaw * 10000n / totalRaw) / 100 : 0;
                  const isComplete = !s.active || Date.now() >= s.end_at;
                  const tokenColor = TOKEN_COLOR[s.token] ?? "#6366f1";
                  return (
                    <div key={s.id} className="card" style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span className="badge" style={{ background: isComplete ? "#111" : "#0a1020", color: isComplete ? "#6b7280" : "#38bdf8", border: `1px solid ${isComplete ? "#6b728030" : "#38bdf830"}` }}>
                              <span className="badge-dot" style={{ background: isComplete ? "#6b7280" : "#38bdf8" }} />
                              {isComplete ? "Completed" : "Streaming"}
                            </span>
                            <span style={{ color: "#4b5563", fontSize: 12 }}>{timeAgo(s.created_at)}</span>
                          </div>
                          <div style={{ fontSize: 14, color: "#9ca3af" }}>
                            <span style={{ color: "#f0f0f4", fontWeight: 600 }}>{s.from_email}</span>
                            <span style={{ margin: "0 8px", color: "#374151" }}>→</span>
                            <span style={{ color: "#f0f0f4", fontWeight: 600 }}>{s.to_email}</span>
                          </div>
                          {s.message && <div style={{ fontSize: 12, color: "#4b5563", marginTop: 5, fontStyle: "italic" }}>&ldquo;{s.message}&rdquo;</div>}
                          {/* Progress bar */}
                          <div style={{ marginTop: 10 }}>
                            <div style={{ height: 4, background: "#1e1e35", borderRadius: 999, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: "#38bdf8", borderRadius: 999 }} />
                            </div>
                            <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>{pct.toFixed(1)}% streamed</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", minWidth: 120 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f0f4", letterSpacing: "-0.03em" }}>
                            <span style={{ color: tokenColor, fontSize: 13 }}>{s.token}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>
                            Ends {timeUntil(s.end_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Subscriptions tab */}
        {tab === "subscriptions" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>Recurring pull payments from subscribers.</p>
            </div>
            {subscriptions.length === 0 ? (
              <div className="card" style={{ padding: 60, textAlign: "center" }}>
                <div style={{ color: "#4b5563", fontSize: 14, marginBottom: 8 }}>No subscriptions yet</div>
                <p style={{ color: "#374151", fontSize: 12 }}>Create a subscription plan via API and share the authorize link.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {subscriptions.map((s) => {
                  const tokenColor = TOKEN_COLOR[s.token] ?? "#6366f1";
                  return (
                    <div key={s.id} className="card" style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span className="badge" style={{ background: s.active ? "#100a20" : "#111", color: s.active ? "#a855f7" : "#6b7280", border: `1px solid ${s.active ? "#a855f730" : "#6b728030"}` }}>
                              <span className="badge-dot" style={{ background: s.active ? "#a855f7" : "#6b7280" }} />
                              {s.active ? "Active" : "Pending auth"}
                            </span>
                          </div>
                          <div style={{ fontSize: 14, color: "#9ca3af" }}>
                            Merchant: <span style={{ color: "#f0f0f4", fontWeight: 600 }}>{s.merchant_email}</span>
                          </div>
                          {s.subscriber_email && (
                            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>
                              Subscriber: <span style={{ color: "#9ca3af" }}>{s.subscriber_email}</span>
                            </div>
                          )}
                          {s.description && <div style={{ fontSize: 12, color: "#4b5563", marginTop: 5, fontStyle: "italic" }}>&ldquo;{s.description}&rdquo;</div>}
                          {!s.active && (
                            <div style={{ marginTop: 8 }}>
                              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/subscribe/${s.id}`); }}
                                className="btn-secondary" style={{ fontSize: 11 }}>Copy authorize link</button>
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right", minWidth: 120 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f0f4", letterSpacing: "-0.03em" }}>
                            <span style={{ color: tokenColor, fontSize: 13 }}>{s.token}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>every {s.interval_days}d</div>
                          {s.next_pull_at && (
                            <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>Next: {timeUntil(s.next_pull_at)}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Recurring tab */}
        {tab === "recurring" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
                Recurring transfers trigger automatically when due.
              </p>
              <Link href="/send" style={{ background: "#6366f1", color: "#fff", fontWeight: 600, padding: "7px 16px", borderRadius: 8, textDecoration: "none", fontSize: 13 }}>
                New recurring
              </Link>
            </div>

            {recurring.length === 0 ? (
              <div className="card" style={{ padding: 60, textAlign: "center" }}>
                <div style={{ color: "#4b5563", fontSize: 14, marginBottom: 20 }}>No recurring transfers</div>
                <Link href="/send" style={{ background: "#6366f1", color: "#fff", fontWeight: 700, padding: "11px 22px", borderRadius: 9, textDecoration: "none", fontSize: 14 }}>
                  Set one up
                </Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recurring.map((r) => (
                  <div key={r.id} className="card" style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span className="badge" style={{ background: r.active ? "#0a150a" : "#111", color: r.active ? "#10b981" : "#6b7280", border: `1px solid ${r.active ? "#10b98130" : "#6b728030"}` }}>
                            <span className="badge-dot" style={{ background: r.active ? "#10b981" : "#6b7280" }} />
                            {r.active ? "Active" : "Cancelled"}
                          </span>
                          <span style={{ color: "#4b5563", fontSize: 12 }}>Every {r.interval_days} days</span>
                        </div>
                        <div style={{ fontSize: 14, color: "#9ca3af" }}>
                          <span style={{ color: "#f0f0f4", fontWeight: 600 }}>{r.from_email}</span>
                          <span style={{ margin: "0 8px", color: "#374151" }}>→</span>
                          <span style={{ color: "#f0f0f4", fontWeight: 600 }}>{r.to_email}</span>
                        </div>
                        {r.message && <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4, fontStyle: "italic" }}>&ldquo;{r.message}&rdquo;</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f0f4", letterSpacing: "-0.02em" }}>
                          — <span style={{ color: TOKEN_COLOR[r.token] ?? "#6366f1", fontSize: 13 }}>{r.token}</span>
                        </div>
                        <div style={{ fontSize: 12, color: r.active ? "#6366f1" : "#4b5563", marginTop: 4 }}>
                          Next: {timeUntil(r.next_at)}
                        </div>
                      </div>
                      {r.active === 1 && (
                        <button onClick={() => cancelRecurring(r.id)} className="btn-secondary" style={{ fontSize: 12, color: "#f87171" }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
