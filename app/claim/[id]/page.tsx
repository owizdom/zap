"use client";

import { useState, useEffect, useCallback } from "react";
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
  lockedUntil: number | null;
}

// Privy types - conditionally available
interface PrivyUser {
  email?: { address: string };
  google?: { email: string; name?: string };
  wallet?: { address: string };
}

interface PrivyHook {
  ready: boolean;
  authenticated: boolean;
  user: PrivyUser | null;
  login: () => void;
  logout: () => Promise<void>;
}

const PRIVY_AVAILABLE = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

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

/**
 * Privy login section component - rendered only when PRIVY_APP_ID is set.
 * Delegates to PrivyLoginInner for the actual hook usage.
 */
function PrivyLoginSection({
  onWalletResolved,
  disabled,
}: {
  onWalletResolved: (address: string, email: string) => void;
  disabled: boolean;
}) {
  if (!PRIVY_AVAILABLE) return null;
  return <PrivyLoginInner onWalletResolved={onWalletResolved} disabled={disabled} />;
}

/**
 * Inner component that actually calls the Privy hook.
 * Must be rendered inside the PrivyProvider tree.
 */
function PrivyLoginInner({
  onWalletResolved,
  disabled,
}: {
  onWalletResolved: (address: string, email: string) => void;
  disabled: boolean;
}) {
  // We dynamically require the hook only when this component mounts
  const [hookModule, setHookModule] = useState<{ usePrivy: () => PrivyHook } | null>(null);

  useEffect(() => {
    import("@privy-io/react-auth").then((mod) => {
      setHookModule({ usePrivy: mod.usePrivy as unknown as () => PrivyHook });
    }).catch(() => {});
  }, []);

  if (!hookModule) {
    return (
      <button
        disabled
        style={{
          width: "100%", padding: "12px 16px", background: "#161625", border: "1px solid #1e1e35",
          borderRadius: 9, color: "#4b5563", fontSize: 14, fontWeight: 600, cursor: "not-allowed",
        }}
      >
        Loading sign-in...
      </button>
    );
  }

  return <PrivyLoginHooked hookModule={hookModule} onWalletResolved={onWalletResolved} disabled={disabled} />;
}

function PrivyLoginHooked({
  hookModule,
  onWalletResolved,
  disabled,
}: {
  hookModule: { usePrivy: () => PrivyHook };
  onWalletResolved: (address: string, email: string) => void;
  disabled: boolean;
}) {
  const { ready, authenticated, user, login, logout } = hookModule.usePrivy();
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!ready || !authenticated || !user || resolved) return;

    // Extract email from Privy user
    const email = user.google?.email || user.email?.address || "";
    // Extract wallet address from Privy-managed wallet
    const walletAddress = user.wallet?.address || "";

    if (walletAddress && email) {
      setResolved(true);
      onWalletResolved(walletAddress, email);
    }
  }, [ready, authenticated, user, resolved, onWalletResolved]);

  if (!ready) {
    return (
      <button
        disabled
        style={{
          width: "100%", padding: "12px 16px", background: "#161625", border: "1px solid #1e1e35",
          borderRadius: 9, color: "#4b5563", fontSize: 14, fontWeight: 600, cursor: "not-allowed",
        }}
      >
        Loading...
      </button>
    );
  }

  if (authenticated && user) {
    const email = user.google?.email || user.email?.address || "your account";
    const walletAddress = user.wallet?.address;

    return (
      <div style={{ width: "100%" }}>
        <div style={{
          background: "#0a150a", border: "1px solid #1a3a1a", borderRadius: 9,
          padding: "12px 16px", marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            <span style={{ fontSize: 13, color: "#10b981", fontWeight: 600 }}>Signed in as {email}</span>
          </div>
          {walletAddress && (
            <div style={{ fontSize: 11, color: "#4b5563", fontFamily: "monospace", wordBreak: "break-all" }}>
              Wallet: {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
            </div>
          )}
          {!walletAddress && (
            <div style={{ fontSize: 11, color: "#f87171" }}>
              Wallet not yet created. Please wait...
            </div>
          )}
        </div>
        <button
          onClick={() => { setResolved(false); logout(); }}
          style={{
            background: "none", border: "none", color: "#4b5563", fontSize: 11,
            cursor: "pointer", textDecoration: "underline", width: "100%", textAlign: "center",
          }}
        >
          Use a different account
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      disabled={disabled}
      style={{
        width: "100%", padding: "13px 16px", background: "#fff", color: "#111",
        border: "none", borderRadius: 9, cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center",
        justifyContent: "center", gap: 10, opacity: disabled ? 0.5 : 1,
        transition: "opacity 0.15s",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Sign in with Google — no wallet needed
    </button>
  );
}

function LockCountdown({ lockedUntil }: { lockedUntil: number }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function calc() {
      const now = Date.now();
      const remaining = Math.max(0, lockedUntil - now);
      const days = Math.floor(remaining / 86400000);
      const hours = Math.floor((remaining % 86400000) / 3600000);
      const mins = Math.floor((remaining % 3600000) / 60000);
      if (remaining <= 0) {
        setTimeLeft("Unlocked!");
        setProgress(100);
      } else if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${mins}m`);
      } else {
        setTimeLeft(`${hours}h ${mins}m`);
      }
      // Simple progress: assume max lock is 90 days
      const elapsed = now - (lockedUntil - 90 * 86400000);
      setProgress(Math.min(100, Math.max(0, (elapsed / (90 * 86400000)) * 100)));
    }
    calc();
    const t = setInterval(calc, 10000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#8b5cf6", letterSpacing: "-0.03em" }}>{timeLeft}</span>
        <span style={{ fontSize: 11, color: "#4b5563" }}>
          Unlocks {new Date(lockedUntil).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>
      <div style={{ height: 6, background: "#1e1e35", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "linear-gradient(90deg, #6366f1, #8b5cf6)", borderRadius: 3, width: `${progress}%`, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

function ProjectedYield({ amount, apy, createdAt, lockedUntil, token }: { amount: number; apy: number; createdAt: number; lockedUntil: number; token: string }) {
  const lockDurationSec = (lockedUntil - createdAt) / 1000;
  const grossYield = amount * apy * (lockDurationSec / (365 * 24 * 3600));
  const netYield = grossYield * 0.9;
  const totalAtUnlock = amount + netYield;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#10b981", letterSpacing: "-0.03em" }}>{totalAtUnlock.toFixed(4)} {token}</div>
        <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>{amount} principal + {netYield.toFixed(4)} yield</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>+{netYield.toFixed(4)}</div>
        <div style={{ fontSize: 10, color: "#4b5563" }}>net yield</div>
      </div>
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
  const [privyEmail, setPrivyEmail] = useState<string | null>(null);
  const [claimMode, setClaimMode] = useState<"privy" | "manual">(PRIVY_AVAILABLE ? "privy" : "manual");

  useEffect(() => {
    fetch(`/api/zap/${id}`)
      .then((r) => r.json())
      .then((data: ZapData) => { setZap(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const handlePrivyWalletResolved = useCallback((walletAddress: string, email: string) => {
    setAddress(walletAddress);
    setPrivyEmail(email);
  }, []);

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
          {privyEmail && (
            <p style={{ color: "#10b981", fontSize: 13, marginBottom: 4 }}>
              Claimed to your wallet via {privyEmail}
            </p>
          )}
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
            <a href={`https://sepolia.voyager.online/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
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
  const isLocked = !!(zap.lockedUntil && Date.now() < zap.lockedUntil);

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

              {/* Yield lock countdown */}
              {zap.lockedUntil && Date.now() < zap.lockedUntil && (
                <div style={{ background: "#0d0a1f", border: "1px solid #2d1f6b", borderRadius: 10, padding: "18px 20px", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 16 }}>&#x1f512;</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.04em" }}>Yield-locked transfer</span>
                  </div>
                  <LockCountdown lockedUntil={zap.lockedUntil} />
                  <div style={{ marginTop: 14, background: "#0a0a15", borderRadius: 8, padding: "12px 14px", border: "1px solid #1e1e35" }}>
                    <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Projected value at unlock</div>
                    <ProjectedYield amount={parseFloat(zap.amount)} apy={zap.apy} createdAt={zap.createdAt} lockedUntil={zap.lockedUntil} token={zap.token} />
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 10, lineHeight: 1.6 }}>
                    This transfer is earning {apyPct}% APY while locked. You&apos;ll be able to claim the full amount plus all accrued yield when the lock expires.
                  </div>
                </div>
              )}

              {/* Claim mode tabs - only show if Privy is available */}
              {PRIVY_AVAILABLE && (
                <div style={{ display: "flex", gap: 0, marginBottom: 18, background: "#161625", borderRadius: 9, border: "1px solid #1e1e35", overflow: "hidden" }}>
                  <button
                    onClick={() => setClaimMode("privy")}
                    style={{
                      flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                      fontSize: 12, fontWeight: 600,
                      background: claimMode === "privy" ? "#6366f1" : "transparent",
                      color: claimMode === "privy" ? "#fff" : "#6b7280",
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    Social login
                  </button>
                  <button
                    onClick={() => setClaimMode("manual")}
                    style={{
                      flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                      fontSize: 12, fontWeight: 600,
                      background: claimMode === "manual" ? "#6366f1" : "transparent",
                      color: claimMode === "manual" ? "#fff" : "#6b7280",
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    Wallet address
                  </button>
                </div>
              )}

              {/* Privy social login mode */}
              {claimMode === "privy" && PRIVY_AVAILABLE && (
                <div style={{ marginBottom: 18 }}>
                  <PrivyLoginSection
                    onWalletResolved={handlePrivyWalletResolved}
                    disabled={claiming}
                  />
                  {privyEmail && address && (
                    <div style={{ marginTop: 14 }}>
                      <button className="btn-primary" onClick={handleClaim} disabled={claiming || !address || isLocked}>
                        {isLocked ? `Locked — unlocks ${new Date(zap.lockedUntil!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : claiming ? "Processing claim..." : `Claim ${zap.amount} ${zap.token} + yield`}
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#4b5563", marginTop: 10, textAlign: "center", fontWeight: 500 }}>
                    {isLocked ? "This transfer is locked and earning yield. Come back when it unlocks." : "Sign in to claim instantly. No wallet app or gas fees needed."}
                  </div>
                </div>
              )}

              {/* Manual address mode */}
              {claimMode === "manual" && (
                <div style={{ marginBottom: 18 }}>
                  <label className="label">Your Starknet address</label>
                  <input className="input" type="text" placeholder="0x..." value={address}
                    onChange={(e) => { setAddress(e.target.value); setPrivyEmail(null); }} />
                  <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6, fontWeight: 500 }}>
                    No wallet?{" "}
                    {PRIVY_AVAILABLE ? (
                      <button
                        onClick={() => setClaimMode("privy")}
                        style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 11, fontWeight: 500, padding: 0 }}
                      >
                        Sign in with Google instead
                      </button>
                    ) : (
                      <a href="https://cartridge.gg" target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1" }}>
                        Create one at cartridge.gg
                      </a>
                    )}
                  </div>
                  <button className="btn-primary" onClick={handleClaim} disabled={claiming || !address || isLocked}
                    style={{ marginTop: 14 }}>
                    {isLocked ? `Locked — unlocks ${new Date(zap.lockedUntil!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : claiming ? "Processing claim..." : `Claim ${zap.amount} ${zap.token} + yield`}
                  </button>
                </div>
              )}

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
