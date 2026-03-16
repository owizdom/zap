"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface SubData {
  id: string;
  merchant_email: string;
  amount: string;
  token: string;
  interval_days: number;
  description: string | null;
  active: number;
  authorized_at: number | null;
  next_pull_at: number | null;
}

export default function SubscribePage() {
  const { id } = useParams<{ id: string }>();
  const [sub, setSub]           = useState<SubData | null>(null);
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/subscription/${id}`)
      .then((r) => r.json())
      .then((d: SubData) => { setSub(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleAuthorize(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError("Email is required"); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/subscription/${id}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriberEmail: email }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Authorization failed");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#6b7280", fontSize: 14 }}>Loading...</div>
      </main>
    );
  }

  if (!sub) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ padding: 36, maxWidth: 380, width: "100%", textAlign: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Subscription not found</h2>
          <p style={{ color: "#6b7280", fontSize: 14 }}>This link may be invalid or expired.</p>
        </div>
      </main>
    );
  }

  if (done || sub.active === 1) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ padding: 40, maxWidth: 420, width: "100%", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#100a20", border: "1px solid #2a1a40", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 22 }}>
            <span style={{ color: "#a855f7" }}>✓</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.03em" }}>Subscription authorized</h2>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 8 }}>
            {sub.merchant_email} can now collect {sub.amount} {sub.token} every {sub.interval_days} days.
          </p>
          <p style={{ color: "#4b5563", fontSize: 12, marginBottom: 24 }}>
            You can cancel anytime from your dashboard.
          </p>
          <Link href="/" style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}>Back to Zapp</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#080810" }}>
      <nav style={{ padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #1e1e35", background: "#080810" }}>
        <span className="logo-mark">Z</span>
        <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>Zapp</span>
      </nav>

      <div style={{ maxWidth: 440, margin: "0 auto", padding: "48px 24px" }}>
        <div className="card" style={{ overflow: "hidden" }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #7c3aed20, #a855f720)", borderBottom: "1px solid #2a1a40", padding: "28px 28px 24px" }}>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10, fontWeight: 500 }}>
              Subscription from <span style={{ color: "#f0f0f4", fontWeight: 600 }}>{sub.merchant_email}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: "#f0f0f4", letterSpacing: "-0.04em" }}>{sub.amount}</span>
              <span style={{ fontSize: 16, color: "#a855f7", fontWeight: 700 }}>{sub.token}</span>
            </div>
            <div style={{ color: "#9ca3af", fontSize: 13 }}>
              every {sub.interval_days} days
            </div>
            {sub.description && (
              <div style={{ marginTop: 10, background: "#0f0f1a", border: "1px solid #1e1e35", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#d1d5db" }}>
                {sub.description}
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleAuthorize} style={{ padding: 28 }}>
            {error && (
              <div style={{ background: "#1f0a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "12px 14px", marginBottom: 18, color: "#f87171", fontSize: 13 }}>
                {error}
              </div>
            )}

            <div style={{ background: "#0f0f1a", border: "1px solid #1e1e35", borderRadius: 8, padding: "12px 14px", marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.6 }}>
                By authorizing, you allow <strong style={{ color: "#9ca3af" }}>{sub.merchant_email}</strong> to collect{" "}
                <strong style={{ color: "#f0f0f4" }}>{sub.amount} {sub.token}</strong> from your Zap wallet every{" "}
                <strong style={{ color: "#f0f0f4" }}>{sub.interval_days} days</strong>. You can cancel anytime.
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label className="label">Your email</label>
              <input className="input" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}
              style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
              {submitting ? "Authorizing..." : `Authorize ${sub.amount} ${sub.token} / ${sub.interval_days}d`}
            </button>

            <p style={{ textAlign: "center", color: "#4b5563", fontSize: 12, marginTop: 14 }}>
              Powered by Starknet · Gasless via AVNU Paymaster
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
