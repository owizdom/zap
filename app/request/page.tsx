"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useEmailSession } from "@/lib/useEmailSession";
import AuthButton from "@/app/components/AuthButton";

type Token = "STRK" | "ETH" | "USDC";
const TOKENS: Token[] = ["STRK", "ETH", "USDC"];
const TOKEN_COLOR: Record<Token, string> = { STRK: "#6366f1", ETH: "#64748b", USDC: "#2563eb" };

export default function RequestPage() {
  const { email: sessionEmail, isSignedIn } = useEmailSession();
  const [form, setForm] = useState({ fromEmail: "", toEmail: "", amount: "1", token: "STRK" as Token, message: "" });

  useEffect(() => {
    if (sessionEmail) setForm((f) => ({ ...f, fromEmail: sessionEmail }));
  }, [sessionEmail]);
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequest() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromEmail: form.fromEmail,
          toEmail: form.toEmail,
          amount: form.amount,
          token: form.token,
          message: form.message || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json() as { id: string };
      setRequestId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (!requestId) return;
    navigator.clipboard.writeText(`${window.location.origin}/pay/${requestId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{ padding: "0 32px", height: 56, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1e35", background: "#080810" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#f0f0f4" }}>
          <span className="logo-mark">Z</span>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>Zapp</span>
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/send" className="nav-link">Send</Link>
          <Link href="/dashboard" className="nav-link">Dashboard</Link>
          <AuthButton />
        </div>
      </nav>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>

          {requestId ? (
            <div className="card" style={{ padding: 36, textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#1a1400", border: "1px solid #3a2800", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 22 }}>
                <span style={{ color: "#f59e0b" }}>💸</span>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.03em" }}>Request created</h2>
              <p style={{ color: "#6b7280", marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
                {form.toEmail
                  ? <>Email sent to <strong style={{ color: "#f0f0f4" }}>{form.toEmail}</strong>. Share the link below too.</>
                  : <>Share this link with whoever you want to pay you.</>
                }
              </p>

              <div style={{ background: "#0f0f1a", border: "1px solid #1e1e35", borderRadius: 9, padding: "12px 14px", marginBottom: 16, fontSize: 12, color: "#6b7280", wordBreak: "break-all", fontFamily: "monospace" }}>
                {typeof window !== "undefined" ? `${window.location.origin}/pay/${requestId}` : `/pay/${requestId}`}
              </div>

              <button onClick={copyLink} className="btn-primary" style={{ marginBottom: 10, background: copied ? "#10b981" : undefined }}>
                {copied ? "Copied!" : "Copy payment link"}
              </button>

              <button onClick={() => { setRequestId(null); setForm({ fromEmail: "", toEmail: "", amount: "1", token: "STRK", message: "" }); }}
                className="btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
                Create another request
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 32 }}>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 5 }}>Request money</h1>
                <p style={{ color: "#6b7280", fontSize: 13 }}>
                  Generate a payment link to send to anyone. They pay via Zap — you receive it in your wallet.
                </p>
              </div>

              {error && (
                <div style={{ background: "#1f0a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "12px 14px", marginBottom: 18, color: "#f87171", fontSize: 13 }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="label">Your email</label>
                  <input className="input" type="email" placeholder="you@gmail.com" value={form.fromEmail}
                    onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))}
                    readOnly={isSignedIn}
                    style={isSignedIn ? { opacity: 0.7, cursor: "default" } : undefined} />
                  {isSignedIn && (
                    <div style={{ fontSize: 11, color: "#10b981", marginTop: 4, fontWeight: 500 }}>✓ Signed in via Google</div>
                  )}
                </div>

                <div>
                  <label className="label">Request from <span style={{ color: "#374151", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(optional — sends them an email)</span></label>
                  <input className="input" type="email" placeholder="payer@example.com" value={form.toEmail}
                    onChange={(e) => setForm((f) => ({ ...f, toEmail: e.target.value }))} />
                </div>

                <div>
                  <label className="label">Amount</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input" type="number" min="0.0001" step="0.1" placeholder="1.0" value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} style={{ flex: 1 }} />
                    <div style={{ display: "flex", background: "#161625", border: "1px solid #1e1e35", borderRadius: 9, overflow: "hidden", flexShrink: 0 }}>
                      {TOKENS.map((t) => (
                        <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, token: t }))}
                          style={{ padding: "0 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: form.token === t ? TOKEN_COLOR[t] : "transparent", color: form.token === t ? "#fff" : "#6b7280" }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label">What's it for? <span style={{ color: "#374151", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(optional)</span></label>
                  <input className="input" type="text" placeholder="Dinner, rent, etc." value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
                </div>

                <button className="btn-primary" onClick={handleRequest}
                  disabled={loading || !form.fromEmail || !form.amount || parseFloat(form.amount) <= 0}>
                  {loading ? "Creating request..." : form.toEmail ? "Create & send request" : "Generate payment link"}
                </button>
              </div>

              <p style={{ fontSize: 11, color: "#374151", textAlign: "center", marginTop: 16, fontWeight: 500 }}>
                Payer receives an email + shareable link
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
