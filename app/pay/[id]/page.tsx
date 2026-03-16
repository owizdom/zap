"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StarkZap } from "starkzap";

interface RequestData {
  id: string;
  fromEmail: string;
  toEmail: string;
  amount: string;
  token: string;
  message: string | null;
  status: string;
  createdAt: number;
}

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<RequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS || "";
  const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || "sepolia") as "sepolia" | "mainnet";

  useEffect(() => {
    fetch(`/api/request/${id}`)
      .then((r) => r.json())
      .then((data: RequestData) => { setRequest(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  async function handlePay() {
    if (!request) return;
    setError(null);
    setPaying(true);
    try {
      const sdk = new StarkZap({
        network: NETWORK,
        paymaster: { nodeUrl: "https://starknet.paymaster.avnu.fi" },
      });

      const wallet = await sdk.connectCartridge({
        policies: [{ target: ESCROW_ADDRESS, method: "transfer" }],
      });

      const { Amount, fromAddress, sepoliaTokens, mainnetTokens } = await import("starkzap");
      const tokens = NETWORK === "sepolia" ? sepoliaTokens : mainnetTokens;
      const tokenObj = tokens[request.token as keyof typeof tokens] ?? tokens.STRK;

      const tx = await wallet.transfer(tokenObj, [
        { to: fromAddress(ESCROW_ADDRESS), amount: Amount.parse(request.amount, tokenObj) },
      ]);
      await tx.wait();
      setTxHash(tx.hash);

      // Mark request as paid and create zap
      const res = await fetch(`/api/request/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: tx.hash }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setPaid(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#6b7280", fontSize: 14 }}>Loading...</div>
      </main>
    );
  }

  if (!request) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ padding: 36, textAlign: "center", maxWidth: 380, width: "100%" }}>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>Not found</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Invalid payment link</h2>
          <p style={{ color: "#6b7280", fontSize: 14 }}>This request may have already been paid or the link has expired.</p>
        </div>
      </main>
    );
  }

  if (request.status === "paid" || paid) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ padding: 36, textAlign: "center", maxWidth: 420, width: "100%" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#0a1f0a", border: "1px solid #14532d", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 22 }}>
            <span style={{ color: "#10b981" }}>✓</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.03em" }}>Payment sent</h2>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
            <strong style={{ color: "#f0f0f4" }}>{request.fromEmail}</strong> will receive a claim email with <strong style={{ color: "#10b981" }}>{request.amount} {request.token}</strong> + yield.
          </p>
          {txHash && (
            <a href={`https://sepolia.starkscan.co/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
              style={{ color: "#6366f1", fontSize: 13, display: "block", marginBottom: 20 }}>
              View transaction →
            </a>
          )}
          <Link href="/" style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}>Back to Zapp</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{ padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #1e1e35", background: "#080810" }}>
        <span className="logo-mark">Z</span>
        <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>Zapp</span>
      </nav>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div className="card" style={{ overflow: "hidden" }}>
            {/* Header */}
            <div style={{ background: "linear-gradient(135deg, #1a1400, #0f0a00)", padding: "24px 24px 20px", borderBottom: "1px solid #1e1e35" }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, fontWeight: 500 }}>
                Payment request from <span style={{ color: "#f0f0f4", fontWeight: 600 }}>{request.fromEmail}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 38, fontWeight: 900, color: "#f0f0f4", letterSpacing: "-0.04em" }}>{request.amount}</span>
                <span style={{ fontSize: 16, color: "#f59e0b", fontWeight: 700 }}>{request.token}</span>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: 24 }}>
              {request.message && (
                <div style={{ background: "#0f0f1a", border: "1px solid #1e1e35", borderRadius: 8, padding: "12px 14px", marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>What it's for</div>
                  <div style={{ fontSize: 14, color: "#e5e7eb", lineHeight: 1.5 }}>&ldquo;{request.message}&rdquo;</div>
                </div>
              )}

              {error && (
                <div style={{ background: "#1f0a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "12px 14px", marginBottom: 18, color: "#f87171", fontSize: 13 }}>
                  {error}
                </div>
              )}

              <button className="btn-primary" onClick={handlePay} disabled={paying}
                style={{ background: paying ? undefined : "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                {paying ? "Processing..." : `Pay ${request.amount} ${request.token}`}
              </button>

              <p style={{ fontSize: 11, color: "#374151", textAlign: "center", marginTop: 14, fontWeight: 500 }}>
                Gasless via Cartridge · Recipient earns yield while waiting to claim
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
