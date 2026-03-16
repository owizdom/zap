"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ZapData {
  id: string;
  fromEmail: string;
  toEmail: string;
  amount: string;
  yieldEarned: string;
  protocolFee: string;
  total: string;
  token: string;
  apy: number;
  status: string;
  createdAt: number;
  claimedAt: number | null;
  message: string | null;
}

function LiveYield({ amountRaw, createdAt, apy = 0.05, token }: { amountRaw: string; createdAt: number; apy?: number; token: string }) {
  const [yieldVal, setYieldVal] = useState("0.000000");

  useEffect(() => {
    const PROTOCOL_FEE_BPS = 0.10;
    const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
    function calc() {
      const elapsed = (Date.now() - createdAt) / 1000;
      const amount = parseFloat(amountRaw);
      const grossYield = amount * apy * (elapsed / SECONDS_PER_YEAR);
      const netYield = grossYield * (1 - PROTOCOL_FEE_BPS);
      const displayDecimals = token === "USDC" ? 4 : 6;
      setYieldVal(netYield.toFixed(displayDecimals + 2));
    }
    calc();
    const t = setInterval(calc, 100);
    return () => clearInterval(t);
  }, [amountRaw, createdAt, apy, token]);

  return <span className="live-yield">+{yieldVal}</span>;
}

function ResendButton({ zapId }: { zapId: string }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    try {
      await fetch(`/api/zap/${zapId}/resend`, { method: "POST" });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ textAlign: "center", marginTop: 12 }}>
      <button onClick={resend} disabled={sending || sent}
        style={{ background: "none", border: "none", color: sent ? "#10b981" : "#4b5563", fontSize: 12, cursor: sent ? "default" : "pointer", textDecoration: sent ? "none" : "underline" }}>
        {sent ? "Email resent ✓" : sending ? "Sending..." : "Didn't receive the email? Resend"}
      </button>
    </div>
  );
}

export default function ClaimPage() {
  const { id } = useParams<{ id: string }>();
  const [zap, setZap] = useState<ZapData | null>(null);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<{ amount: string; yieldEarned: string; protocolFee: string; total: string; apy: number } | null>(null);

  useEffect(() => {
    fetch(`/api/zap/${id}`)
      .then((r) => r.json())
      .then((data: ZapData) => { setZap(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  async function handleClaim() {
    if (!address.startsWith("0x") || address.length < 10) {
      setError("Please enter a valid Starknet address starting with 0x");
      return;
    }
    setError(null);
    setClaiming(true);
    try {
      const res = await fetch(`/api/zap/${id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientAddress: address }),
      });
      const data = await res.json() as { success?: boolean; txHash?: string; error?: string; amount: string; yieldEarned: string; protocolFee: string; total: string; apy: number };
      if (!res.ok) throw new Error(data.error || "Claim failed");
      setTxHash(data.txHash || null);
      setClaimResult({ amount: data.amount, yieldEarned: data.yieldEarned, protocolFee: data.protocolFee, total: data.total, apy: data.apy });
      setClaimed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#6b7280", fontSize: 14 }}>Loading...</div>
      </main>
    );
  }

  if (!zap) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ padding: 36, textAlign: "center", maxWidth: 380, width: "100%" }}>
          <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>Not found</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>This link is invalid</h2>
          <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>The transfer may have already been claimed or the link has expired.</p>
        </div>
      </main>
    );
  }

  if (zap.status === "claimed" || claimed) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ padding: 36, textAlign: "center", maxWidth: 420, width: "100%" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#0a1f0a", border: "1px solid #14532d", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 22 }}>
            <span style={{ color: "#10b981" }}>✓</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.03em" }}>Transfer claimed</h2>
          {claimResult ? (
            <>
              <div style={{ background: "#0a120a", border: "1px solid #1a3a1a", borderRadius: 10, padding: "18px 20px", margin: "20px 0" }}>
                <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>You received</div>
                <div style={{ color: "#10b981", fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em" }}>{claimResult.total} {zap.token}</div>
                <div style={{ color: "#4b5563", fontSize: 12, marginTop: 6 }}>
                  {claimResult.amount} principal + {claimResult.yieldEarned} yield
                </div>
              </div>
              <div style={{ background: "#0d0d1f", border: "1px solid #1e1e35", borderRadius: 9, padding: "12px 16px", marginBottom: 20, textAlign: "left" }}>
                <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Yield breakdown</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#6b7280" }}>Gross yield ({((claimResult.apy ?? 0.05) * 100).toFixed(1)}% APY)</span>
                  <span style={{ color: "#9ca3af" }}>{(parseFloat(claimResult.yieldEarned) + parseFloat(claimResult.protocolFee)).toFixed(6)} {zap.token}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#6b7280" }}>Protocol fee (10%)</span>
                  <span style={{ color: "#f87171" }}>−{claimResult.protocolFee} {zap.token}</span>
                </div>
                <div style={{ height: 1, background: "#1e1e35", margin: "8px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                  <span style={{ color: "#9ca3af" }}>Net yield to you</span>
                  <span style={{ color: "#10b981" }}>+{claimResult.yieldEarned} {zap.token}</span>
                </div>
              </div>
            </>
          ) : (
            <p style={{ color: "#6b7280", margin: "20px 0", fontSize: 14 }}>This transfer has already been claimed.</p>
          )}
          {txHash && (
            <a href={`https://sepolia.starkscan.co/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
              style={{ color: "#6366f1", fontSize: 13, display: "block", marginBottom: 20 }}>
              View transaction →
            </a>
          )}
          <Link href="/" style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}>Back to Zap</Link>
        </div>
      </main>
    );
  }

  const apyPct = ((zap.apy ?? 0.05) * 100).toFixed(1);

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{ padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #1e1e35", background: "#080810" }}>
        <span className="logo-mark">Z</span>
        <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>Zapp</span>
      </nav>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div className="card" style={{ overflow: "hidden", marginBottom: 12 }}>
            {/* Header */}
            <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid #1e1e35" }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, fontWeight: 500 }}>
                Transfer from <span style={{ color: "#9ca3af", fontWeight: 600 }}>{zap.fromEmail}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 38, fontWeight: 900, color: "#f0f0f4", letterSpacing: "-0.04em" }}>{zap.amount}</span>
                <span style={{ fontSize: 16, color: "#6366f1", fontWeight: 700 }}>{zap.token}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>Live yield: </span>
                  <LiveYield amountRaw={zap.amount} createdAt={zap.createdAt} apy={zap.apy} token={zap.token} />
                  <span style={{ color: "#6b7280", fontSize: 12 }}>{zap.token}</span>
                </div>
                <span style={{ background: "#0a150a", border: "1px solid #1a3a1a", color: "#34d399", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>
                  {apyPct}% APY
                </span>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: 24 }}>
              {zap.message && (
                <div style={{ background: "#0f0f1a", border: "1px solid #1e1e35", borderRadius: 8, padding: "12px 14px", marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Message</div>
                  <div style={{ fontSize: 14, color: "#e5e7eb", lineHeight: 1.5 }}>&ldquo;{zap.message}&rdquo;</div>
                </div>
              )}

              {error && (
                <div style={{ background: "#1f0a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "12px 14px", marginBottom: 18, color: "#f87171", fontSize: 13 }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: 18 }}>
                <label className="label">Your Starknet address</label>
                <input className="input" type="text" placeholder="0x..." value={address}
                  onChange={(e) => setAddress(e.target.value)} />
                <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6, fontWeight: 500 }}>
                  No wallet?{" "}
                  <a href="https://cartridge.gg" target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1" }}>
                    Create one at cartridge.gg
                  </a>
                </div>
              </div>

              <button className="btn-primary" onClick={handleClaim} disabled={claiming || !address}>
                {claiming ? "Processing claim..." : `Claim ${zap.amount} ${zap.token} + yield`}
              </button>

              <div style={{ background: "#0d0d1f", border: "1px solid #1e1e35", borderRadius: 8, padding: "10px 14px", marginTop: 14 }}>
                <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 4 }}>
                  Yield is net of 10% protocol fee · Real staking APY from Starknet validators
                </div>
              </div>

              <ResendButton zapId={id} />
            </div>
          </div>

          <p style={{ textAlign: "center", color: "#374151", fontSize: 12, fontWeight: 500 }}>
            Unclaimed transfers return to sender after 30 days.
          </p>
        </div>
      </div>
    </main>
  );
}
