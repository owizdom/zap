"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useEmailSession } from "@/lib/useEmailSession";
import AuthButton from "@/app/components/AuthButton";

const TOKENS = [
  { symbol: "STRK", color: "#6366f1" },
  { symbol: "ETH",  color: "#64748b" },
  { symbol: "USDC", color: "#2563eb" },
];

const DURATIONS = [
  { label: "7 days",   value: 7 },
  { label: "14 days",  value: 14 },
  { label: "30 days",  value: 30 },
  { label: "90 days",  value: 90 },
  { label: "180 days", value: 180 },
  { label: "365 days", value: 365 },
];

export default function StreamPage() {
  const { email: sessionEmail, isSignedIn } = useEmailSession();
  const [fromEmail, setFromEmail]   = useState("");

  useEffect(() => {
    if (sessionEmail) setFromEmail(sessionEmail);
  }, [sessionEmail]);
  const [toEmail, setToEmail]       = useState("");
  const [amount, setAmount]         = useState("");
  const [token, setToken]           = useState("STRK");
  const [durationDays, setDuration] = useState(30);
  const [message, setMessage]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [done, setDone]             = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const perSecond = amount && durationDays
    ? (parseFloat(amount) / (durationDays * 86400)).toFixed(8)
    : null;

  const tokenColor = TOKENS.find((t) => t.symbol === token)?.color ?? "#6366f1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fromEmail || !toEmail || !amount) {
      setError("Please fill in all required fields");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromEmail, toEmail, totalAmount: amount, token, durationDays, message: message || undefined }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed");
      setDone(data.id!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ padding: 40, maxWidth: 420, width: "100%", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#0a1020", border: "1px solid #1a3a60", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 22 }}>
            <span style={{ color: "#38bdf8", fontSize: 20, fontWeight: 900 }}>~</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.03em" }}>Stream started</h2>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
            {toEmail} will receive a notification and can claim anytime.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/dashboard" style={{ background: "#6366f1", color: "#fff", fontWeight: 700, padding: "11px 22px", borderRadius: 9, textDecoration: "none", fontSize: 14 }}>
              Dashboard
            </Link>
            <button onClick={() => { setDone(null); setAmount(""); setFromEmail(""); setToEmail(""); setMessage(""); }}
              className="btn-secondary" style={{ fontSize: 14 }}>
              New stream
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#080810" }}>
      <nav style={{ padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e1e35", background: "#080810" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#f0f0f4" }}>
          <span className="logo-mark">Z</span>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>Zap</span>
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/dashboard" style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}>Dashboard</Link>
          <AuthButton />
        </div>
      </nav>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#0a1020", border: "1px solid #1a3a60", borderRadius: 99, padding: "4px 12px", marginBottom: 12 }}>
              <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 600 }}>Salary Streaming</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>Stream a salary</h1>
          <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
            Tokens drip per second. Recipient can claim anytime — no waiting for payroll day.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card" style={{ padding: 28 }}>
          {error && (
            <div style={{ background: "#1f0a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "12px 14px", marginBottom: 18, color: "#f87171", fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Token selector */}
          <div style={{ marginBottom: 18 }}>
            <label className="label">Token</label>
            <div style={{ display: "flex", gap: 8 }}>
              {TOKENS.map((t) => (
                <button key={t.symbol} type="button" onClick={() => setToken(t.symbol)}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    background: token === t.symbol ? `${t.color}20` : "#0f0f1a",
                    border: `1px solid ${token === t.symbol ? t.color : "#1e1e35"}`,
                    color: token === t.symbol ? t.color : "#6b7280" }}>
                  {t.symbol}
                </button>
              ))}
            </div>
          </div>

          {/* From email */}
          <div style={{ marginBottom: 14 }}>
            <label className="label">From (your email)</label>
            <input className="input" type="email" placeholder="you@gmail.com" value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)} required
              readOnly={isSignedIn}
              style={isSignedIn ? { opacity: 0.7, cursor: "default" } : undefined} />
            {isSignedIn && (
              <div style={{ fontSize: 11, color: "#10b981", marginTop: 4, fontWeight: 500 }}>✓ Signed in via Google</div>
            )}
          </div>

          {/* To email */}
          <div style={{ marginBottom: 14 }}>
            <label className="label">To (recipient email)</label>
            <input className="input" type="email" placeholder="employee@example.com" value={toEmail}
              onChange={(e) => setToEmail(e.target.value)} required />
          </div>

          {/* Total amount */}
          <div style={{ marginBottom: 14 }}>
            <label className="label">Total amount</label>
            <div style={{ position: "relative" }}>
              <input className="input" type="number" placeholder="0.00" step="any" min="0" value={amount}
                onChange={(e) => setAmount(e.target.value)} required
                style={{ paddingRight: 60 }} />
              <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: tokenColor, fontSize: 13, fontWeight: 700 }}>
                {token}
              </span>
            </div>
          </div>

          {/* Duration */}
          <div style={{ marginBottom: 14 }}>
            <label className="label">Duration</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DURATIONS.map((d) => (
                <button key={d.value} type="button" onClick={() => setDuration(d.value)}
                  style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: durationDays === d.value ? "#6366f120" : "#0f0f1a",
                    border: `1px solid ${durationDays === d.value ? "#6366f1" : "#1e1e35"}`,
                    color: durationDays === d.value ? "#818cf8" : "#6b7280" }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Per-second rate preview */}
          {perSecond && (
            <div style={{ background: "#0a1020", border: "1px solid #1a3a60", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
              <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 600 }}>Rate: </span>
              <span style={{ color: "#f0f0f4", fontSize: 12 }}>{perSecond} {token}/sec</span>
              <span style={{ color: "#4b5563", fontSize: 12 }}> · {(parseFloat(perSecond) * 3600).toFixed(6)} {token}/hr</span>
            </div>
          )}

          {/* Message */}
          <div style={{ marginBottom: 20 }}>
            <label className="label">Note <span style={{ color: "#4b5563", fontWeight: 400 }}>(optional)</span></label>
            <input className="input" type="text" placeholder="Monthly salary, Q1 bonus, etc." value={message}
              onChange={(e) => setMessage(e.target.value)} />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Starting stream..." : `Start stream — ${amount || "0"} ${token} over ${durationDays} days`}
          </button>
        </form>

        <p style={{ textAlign: "center", color: "#374151", fontSize: 12, marginTop: 16 }}>
          Recipient can claim any accrued amount at any time. First on Starknet.
        </p>
      </div>
    </main>
  );
}
