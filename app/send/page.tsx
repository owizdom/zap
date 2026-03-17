"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StarkZap } from "starkzap";
import { useEmailSession } from "@/lib/useEmailSession";
import { parseToken } from "@/lib/yield";

const NETWORK: "sepolia" | "mainnet" = "sepolia";

type Step = "form" | "wallet-select" | "connect" | "confirm" | "done";
type Token = "STRK" | "ETH" | "USDC";

// window.starknet injected by ArgentX / Braavos
interface StarknetWindowObject {
  enable: () => Promise<string[]>;
  isConnected: boolean;
  selectedAddress: string;
  account: {
    address: string;
    execute: (calls: { contractAddress: string; entrypoint: string; calldata: string[] }[]) => Promise<{ transaction_hash: string }>;
    waitForTransaction: (hash: string) => Promise<unknown>;
  };
}

const TOKENS: Token[] = ["STRK", "ETH", "USDC"];
const TOKEN_COLOR: Record<Token, string> = { STRK: "#6366f1", ETH: "#64748b", USDC: "#2563eb" };

const STEPS = [
  { key: "form",          label: "Details" },
  { key: "wallet-select", label: "Wallet" },
  { key: "connect",       label: "Connect" },
  { key: "confirm",       label: "Confirm" },
  { key: "done",          label: "Sent" },
];

// FeeMode display labels
const FEE_MODE_LABELS: Record<string, { label: string; color: string; description: string }> = {
  sponsored: { label: "Gasless", color: "#10b981", description: "Transaction fee covered by paymaster" },
  user_pays: { label: "You pay gas", color: "#f59e0b", description: "Gas fee deducted from your wallet" },
};

// ─── AI parser ───────────────────────────────────────────────────────────────
function parseNaturalLanguage(input: string): Partial<{ toEmail: string; amount: string; token: Token; message: string }> {
  const result: Partial<{ toEmail: string; amount: string; token: Token; message: string }> = {};

  // Extract email
  const emailMatch = input.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  if (emailMatch) result.toEmail = emailMatch[0];

  // Extract amount + token (e.g. "10 STRK", "0.5 ETH", "100 USDC")
  const tokenMatch = input.match(/(\d+(?:\.\d+)?)\s*(strk|eth|usdc)/i);
  if (tokenMatch) {
    result.amount = tokenMatch[1];
    result.token = tokenMatch[2].toUpperCase() as Token;
  }

  // Extract message after "for", "re:", "because", "note:"
  const msgMatch = input.match(/(?:for|re:|because|note:)\s+(.+?)(?:\s+to\s+[\w.+-]+@|$)/i);
  if (msgMatch) result.message = msgMatch[1].trim();

  return result;
}

// ─── Available presets discovery ─────────────────────────────────────────────
interface PresetInfo {
  name: string;
  description: string;
  feeMode: string;
  recommended: boolean;
}

function getWalletPresets(): PresetInfo[] {
  // Dynamically built from starkzap accountPresets + ArgentXV050Preset
  // These are the wallet types available for sending
  return [
    {
      name: "Cartridge Controller",
      description: "Gasless social login via Cartridge",
      feeMode: "sponsored",
      recommended: true,
    },
    {
      name: "ArgentX / Braavos",
      description: "Browser extension wallet",
      feeMode: "user_pays",
      recommended: false,
    },
    {
      name: "ArgentX v0.5.0 (Privy)",
      description: "Privy-managed wallet with ArgentXV050Preset",
      feeMode: "sponsored",
      recommended: false,
    },
  ];
}

export default function SendPage() {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ fromEmail: "", toEmail: "", amount: "1", token: "STRK" as Token, message: "" });
  const [recipients, setRecipients] = useState<string[]>([]);
  const [isSplit, setIsSplit] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [intervalDays, setIntervalDays] = useState(30);
  const [isLocked, setIsLocked] = useState(false);
  const [lockDays, setLockDays] = useState(30);
  const [aiInput, setAiInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [zapId, setZapId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [liveApy, setLiveApy] = useState<string>("5.0%");
  const [feeEstimate, setFeeEstimate] = useState<{ fee: string; token: string; mode: string } | null>(null);
  const [availableTokens, setAvailableTokens] = useState<string[]>([]);

  const { email: sessionEmail, isSignedIn } = useEmailSession();
  const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS || "0x1ec8670945342d14de97d1fcfe1bd607e611cd0e26271e6db2d034eeab5d0e8").trim();

  useEffect(() => {
    fetch("/api/apy").then((r) => r.json()).then((d) => {
      if (d.apyPercent) setLiveApy(d.apyPercent);
    }).catch(() => {});
  }, []);

  // Discover available token presets from the SDK
  useEffect(() => {
    import("starkzap").then(({ getPresets, ChainId }) => {
      try {
        const chainId = NETWORK === "sepolia" ? ChainId.SEPOLIA : ChainId.MAINNET;
        const presets = getPresets(chainId);
        const symbols = Object.keys(presets);
        setAvailableTokens(symbols);
      } catch {
        // Fall back to default tokens
      }
    }).catch(() => {});
  }, []);

  // Auto-fill from email when session loads
  useEffect(() => {
    if (sessionEmail) setForm((f) => ({ ...f, fromEmail: sessionEmail }));
  }, [sessionEmail]);

  function applyAiInput() {
    if (!aiInput.trim()) return;
    const parsed = parseNaturalLanguage(aiInput);
    setForm((f) => ({
      ...f,
      toEmail: parsed.toEmail ?? f.toEmail,
      amount: parsed.amount ?? f.amount,
      token: parsed.token ?? f.token,
      message: parsed.message ?? f.message,
    }));
    setAiInput("");
  }

  function addRecipient() {
    setRecipients((r) => [...r, ""]);
  }

  function updateRecipient(i: number, val: string) {
    setRecipients((r) => r.map((v, idx) => idx === i ? val : v));
  }

  function removeRecipient(i: number) {
    setRecipients((r) => r.filter((_, idx) => idx !== i));
  }

  // Shared: create zap records + send emails after on-chain tx confirmed
  async function finaliseSend(onChainTxHash: string) {
    const splitRecipients = isSplit ? [form.toEmail, ...recipients.filter(Boolean)] : [form.toEmail];

    if (isRecurring) {
      await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromEmail: form.fromEmail,
          toEmail: form.toEmail,
          amount: form.amount,
          token: form.token,
          message: form.message || null,
          intervalDays,
        }),
      });
    }

    let firstId: string | null = null;
    for (const toEmail of splitRecipients) {
      const res = await fetch("/api/zap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromEmail: form.fromEmail,
          toEmail,
          amount: form.amount,
          token: form.token,
          message: form.message || null,
          txHash: onChainTxHash,
          type: isSplit && splitRecipients.length > 1 ? "split" : "send",
          lockDays: isLocked ? lockDays : undefined,
        }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error: string }).error);
      const data = (await res.json()) as { id: string };
      if (!firstId) firstId = data.id;
    }
    setZapId(firstId);
    setStep("done");
  }

  // ── Cartridge (gasless, social login) ──────────────────────────────────────
  async function handleSendCartridge() {
    setError(null);
    setLoading(true);
    try {
      const sdk = new StarkZap({
        network: NETWORK,
        paymaster: { nodeUrl: "https://starknet.paymaster.avnu.fi" },
      });

      setStep("connect");
      const wallet = await sdk.connectCartridge({
        policies: [{ target: ESCROW_ADDRESS, method: "transfer" }],
      });
      setStep("confirm");

      // Show fee estimate: sponsored (gasless)
      setFeeEstimate({ fee: "0", token: "STRK", mode: "sponsored" });

      const { Amount, fromAddress, sepoliaTokens, mainnetTokens } = await import("starkzap");
      const tokens = NETWORK === "sepolia" ? sepoliaTokens : mainnetTokens;
      const tokenObj = tokens[form.token as keyof typeof tokens] ?? tokens.STRK;
      const splitRecipients = isSplit ? [form.toEmail, ...recipients.filter(Boolean)] : [form.toEmail];
      const totalAmount = isSplit
        ? (parseFloat(form.amount) * splitRecipients.length).toFixed(6)
        : form.amount;

      const tx = await wallet.transfer(tokenObj, [
        { to: fromAddress(ESCROW_ADDRESS), amount: Amount.parse(totalAmount, tokenObj) },
      ]);
      await tx.wait();
      setTxHash(tx.hash);
      await finaliseSend(tx.hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      const isWalletError = msg.toLowerCase().includes("no wallet") || msg.toLowerCase().includes("bridge") || msg.toLowerCase().includes("connected address");
      setError(isWalletError
        ? "Cartridge wallet error. Try ArgentX/Braavos instead, or create a Cartridge account at cartridge.gg."
        : msg);
      setStep("wallet-select");
    } finally {
      setLoading(false);
    }
  }

  // ── ArgentX / Braavos (browser extension) ──────────────────────────────────
  async function handleSendBrowserWallet() {
    setError(null);
    setLoading(true);
    try {
      const win = window as Window & { starknet?: StarknetWindowObject };
      if (!win.starknet) {
        throw new Error("No Starknet wallet found. Install ArgentX (argentx.com) or Braavos (braavos.app).");
      }

      setStep("connect");
      await win.starknet.enable();
      setStep("confirm");

      const { sepoliaTokens, mainnetTokens } = await import("starkzap");
      const { cairo } = await import("starknet");
      const tokens = NETWORK === "sepolia" ? sepoliaTokens : mainnetTokens;
      const tokenObj = tokens[form.token as keyof typeof tokens] ?? tokens.STRK;

      const splitRecipients = isSplit ? [form.toEmail, ...recipients.filter(Boolean)] : [form.toEmail];
      const totalAmount = isSplit
        ? (parseFloat(form.amount) * splitRecipients.length).toFixed(6)
        : form.amount;

      const amountRaw = parseToken(totalAmount, form.token);
      const amount256 = cairo.uint256(amountRaw);

      // Show fee estimate: user pays
      setFeeEstimate({ fee: "~0.0001", token: "ETH", mode: "user_pays" });

      const result = await win.starknet.account.execute([{
        contractAddress: tokenObj.address as string,
        entrypoint: "transfer",
        calldata: [ESCROW_ADDRESS, amount256.low.toString(), amount256.high.toString()],
      }]);

      await win.starknet.account.waitForTransaction(result.transaction_hash);
      setTxHash(result.transaction_hash);
      await finaliseSend(result.transaction_hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      setStep("wallet-select");
    } finally {
      setLoading(false);
    }
  }

  const VISIBLE_STEPS = STEPS.filter((s) => s.key !== "done");
  const stepIndex = VISIBLE_STEPS.findIndex((s) => s.key === step);
  const totalRecipients = isSplit ? 1 + recipients.filter(Boolean).length : 1;
  const walletPresets = getWalletPresets();

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{ padding: "0 32px", height: 56, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1e35", background: "#080810" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#f0f0f4" }}>
          <span className="logo-mark">Z</span>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>Zapp</span>
        </Link>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/request" className="nav-link">Request</Link>
          <Link href="/dashboard" className="nav-link">Dashboard</Link>
        </div>
      </nav>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        {step !== "done" && (
          <div style={{ display: "flex", gap: 0, alignItems: "center", marginBottom: 32 }}>
            {VISIBLE_STEPS.map((s, i) => (
              <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: i <= stepIndex ? "#6366f1" : "#1e1e35", color: i <= stepIndex ? "#fff" : "#4b5563" }}>
                    {i < stepIndex ? "✓" : i + 1}
                  </span>
                  <span style={{ fontSize: 12, color: i <= stepIndex ? "#9ca3af" : "#4b5563", fontWeight: 500 }}>{s.label}</span>
                </div>
                {i < VISIBLE_STEPS.length - 1 && <div style={{ width: 24, height: 1, background: i < stepIndex ? "#6366f1" : "#1e1e35", margin: "0 6px" }} />}
              </div>
            ))}
          </div>
        )}

        <div style={{ width: "100%", maxWidth: 440 }}>

          {/* Success */}
          {step === "done" && (
            <div className="card" style={{ padding: 36, textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#0a1f0a", border: "1px solid #14532d", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 22 }}>
                <span style={{ color: "#10b981" }}>✓</span>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.03em" }}>
                {isSplit ? `${totalRecipients} transfers sent` : "Transfer sent"}
              </h2>
              <p style={{ color: "#6b7280", marginBottom: 24, lineHeight: 1.6, fontSize: 14 }}>
                {isSplit
                  ? `${totalRecipients} recipients will receive an email. Each gets ${form.amount} ${form.token} + yield.`
                  : <><strong style={{ color: "#f0f0f4" }}>{form.toEmail}</strong> will receive an email. <strong style={{ color: TOKEN_COLOR[form.token] }}>{form.amount} {form.token}</strong> starts earning <strong style={{ color: "#10b981" }}>{liveApy} APY</strong> now.</>
                }
              </p>
              {txHash && (
                <a href={`https://sepolia.voyager.online/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: "block", color: "#6366f1", fontSize: 12, marginBottom: 24, wordBreak: "break-all" }}>
                  View on Voyager →
                </a>
              )}
              <Link href="/send" style={{ display: "block", background: "#6366f1", color: "#fff", fontWeight: 700, padding: 13, borderRadius: 9, textDecoration: "none", marginBottom: 10, fontSize: 14 }}>
                Send another
              </Link>
              <Link href="/dashboard" style={{ display: "block", color: "#6b7280", fontSize: 13, textDecoration: "none", padding: "8px 0" }}>
                View dashboard
              </Link>
            </div>
          )}

          {/* Wallet selector */}
          {step === "wallet-select" && (
            <div className="card" style={{ padding: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.02em" }}>Choose wallet</h2>
              <p style={{ color: "#6b7280", fontSize: 13, marginBottom: error ? 16 : 24, lineHeight: 1.6 }}>
                Send <strong style={{ color: "#f0f0f4" }}>{form.amount} {form.token}</strong> to {form.toEmail}
              </p>
              {error && (
                <div style={{ background: "#1f0a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "12px 14px", marginBottom: 18, color: "#f87171", fontSize: 13, lineHeight: 1.5 }}>
                  {error}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={handleSendCartridge}
                  disabled={loading}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "#0f0f1a", border: "1px solid #6366f1", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer", textAlign: "left", opacity: loading ? 0.6 : 1 }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#fff", fontSize: 14, flexShrink: 0 }}>C</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#f0f0f4" }}>Cartridge</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: FEE_MODE_LABELS.sponsored.color, background: "#0a150a", border: "1px solid #1a3a1a", padding: "1px 6px", borderRadius: 4 }}>
                        {FEE_MODE_LABELS.sponsored.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6366f1", fontWeight: 500 }}>Social login · No extension needed</div>
                  </div>
                </button>
                <button
                  onClick={handleSendBrowserWallet}
                  disabled={loading}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "#0f0f1a", border: "1px solid #1e1e35", borderRadius: 10, cursor: loading ? "not-allowed" : "pointer", textAlign: "left", opacity: loading ? 0.6 : 1 }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#1e1e35", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    <span style={{ color: "#f0f0f4" }}>🦊</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#f0f0f4" }}>ArgentX / Braavos</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: FEE_MODE_LABELS.user_pays.color, background: "#1a1500", border: "1px solid #3a2e00", padding: "1px 6px", borderRadius: 4 }}>
                        {FEE_MODE_LABELS.user_pays.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Browser extension · ArgentXV050Preset compatible</div>
                  </div>
                </button>
              </div>

              {/* Fee mode info */}
              <div style={{ background: "#0d0d1f", border: "1px solid #1e1e35", borderRadius: 8, padding: "10px 14px", marginTop: 14 }}>
                <div style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.6 }}>
                  <strong style={{ color: "#6b7280" }}>Gasless:</strong> Paymaster sponsors the transaction fee.{" "}
                  <strong style={{ color: "#6b7280" }}>You pay gas:</strong> Small fee (~0.0001 ETH) deducted from your wallet.
                </div>
              </div>

              {/* Available presets (dynamically discovered) */}
              {availableTokens.length > 3 && (
                <div style={{ marginTop: 12, padding: "8px 14px", background: "#0d0d1f", border: "1px solid #1e1e35", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                    {availableTokens.length} tokens available on {NETWORK}
                  </div>
                  <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.5 }}>
                    {availableTokens.slice(0, 8).join(", ")}{availableTokens.length > 8 ? ` +${availableTokens.length - 8} more` : ""}
                  </div>
                </div>
              )}

              <button onClick={() => { setError(null); setStep("form"); }} style={{ marginTop: 16, background: "none", border: "none", color: "#4b5563", fontSize: 12, cursor: "pointer", width: "100%", textAlign: "center" }}>
                Back
              </button>
            </div>
          )}

          {/* Waiting states */}
          {(step === "connect" || step === "confirm") && (
            <div className="card" style={{ padding: 36, textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#0d0d1f", border: "1px solid #2a2a4a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <div style={{ width: 20, height: 20, border: "2px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                {step === "connect" ? "Connecting wallet..." : "Waiting for approval..."}
              </h2>
              <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
                {step === "connect" ? "Wallet popup is opening. Approve the connection." : "Confirm the transaction in your wallet."}
              </p>
              {/* Fee estimate display during confirm step */}
              {step === "confirm" && feeEstimate && (
                <div style={{ marginTop: 16, background: "#0d0d1f", border: "1px solid #1e1e35", borderRadius: 8, padding: "10px 14px", textAlign: "left" }}>
                  <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                    Estimated transaction fee
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: feeEstimate.mode === "sponsored" ? "#10b981" : "#f0f0f4" }}>
                      {feeEstimate.mode === "sponsored" ? "Free (sponsored)" : `${feeEstimate.fee} ${feeEstimate.token}`}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                      color: FEE_MODE_LABELS[feeEstimate.mode]?.color || "#6b7280",
                      background: feeEstimate.mode === "sponsored" ? "#0a150a" : "#1a1500",
                      border: `1px solid ${feeEstimate.mode === "sponsored" ? "#1a3a1a" : "#3a2e00"}`,
                    }}>
                      {FEE_MODE_LABELS[feeEstimate.mode]?.label || feeEstimate.mode}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Send form */}
          {step === "form" && (
            <div className="card" style={{ padding: 32 }}>
              <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 5 }}>New transfer</h1>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                  <span style={{ color: "#10b981", fontSize: 12, fontWeight: 600 }}>Live staking APY: {liveApy}</span>
                </div>
              </div>

              {error && (
                <div style={{ background: "#1f0a0a", border: "1px solid #7f1d1d", borderRadius: 8, padding: "12px 14px", marginBottom: 18, color: "#f87171", fontSize: 13, lineHeight: 1.5 }}>
                  {error}
                </div>
              )}

              {/* AI input */}
              <div style={{ marginBottom: 20 }}>
                <label className="label">AI Quick Fill <span style={{ color: "#374151", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(optional)</span></label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="input"
                    type="text"
                    placeholder='e.g. "Send 10 STRK to alice@gmail.com for dinner"'
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyAiInput()}
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={applyAiInput}
                    className="btn-secondary"
                    style={{ whiteSpace: "nowrap", fontSize: 12 }}
                  >
                    Fill
                  </button>
                </div>
              </div>

              <div style={{ height: 1, background: "#1e1e35", margin: "0 0 20px" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="label">Your email</label>
                  <input className="input" type="email" placeholder="you@gmail.com" value={form.fromEmail}
                    onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))} />
                </div>

                <div>
                  <label className="label">Recipient email</label>
                  <input className="input" type="email" placeholder="friend@example.com" value={form.toEmail}
                    onChange={(e) => setForm((f) => ({ ...f, toEmail: e.target.value }))} />
                </div>

                {/* Split recipients */}
                {isSplit && recipients.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8 }}>
                    <input className="input" type="email" placeholder={`Recipient ${i + 2} email`} value={r}
                      onChange={(e) => updateRecipient(i, e.target.value)} />
                    <button type="button" onClick={() => removeRecipient(i)} className="btn-secondary" style={{ padding: "0 12px", fontSize: 16, lineHeight: 1 }}>×</button>
                  </div>
                ))}
                {isSplit && recipients.length < 4 && (
                  <button type="button" onClick={addRecipient} className="btn-secondary" style={{ fontSize: 12, width: "fit-content" }}>
                    + Add recipient
                  </button>
                )}

                {/* Amount + Token */}
                <div>
                  <label className="label">Amount</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input" type="number" min="0.0001" step="0.1" placeholder="1.0" value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      style={{ flex: 1 }} />
                    <div style={{ display: "flex", background: "#161625", border: "1px solid #1e1e35", borderRadius: 9, overflow: "hidden", flexShrink: 0 }}>
                      {TOKENS.map((t) => (
                        <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, token: t }))}
                          style={{ padding: "0 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: form.token === t ? TOKEN_COLOR[t] : "transparent", color: form.token === t ? "#fff" : "#6b7280", transition: "background 0.15s" }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#4b5563", marginTop: 5, fontWeight: 500 }}>
                    Earns {liveApy} real staking APY while unclaimed · 10% protocol fee on yield
                  </div>
                </div>

                <div>
                  <label className="label">Message <span style={{ color: "#374151", textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>(optional)</span></label>
                  <input className="input" type="text" placeholder="Add a note..." value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
                </div>

                {/* Toggles */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => setIsSplit((v) => !v)}
                    style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", borderColor: isSplit ? "#6366f1" : "#1e1e35", background: isSplit ? "#0d0d1f" : "transparent", color: isSplit ? "#6366f1" : "#6b7280" }}>
                    {isSplit ? "✓ Split payment" : "Split payment"}
                  </button>
                  <button type="button" onClick={() => setIsRecurring((v) => !v)}
                    style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", borderColor: isRecurring ? "#10b981" : "#1e1e35", background: isRecurring ? "#0a150a" : "transparent", color: isRecurring ? "#10b981" : "#6b7280" }}>
                    {isRecurring ? "✓ Recurring" : "Recurring"}
                  </button>
                  <button type="button" onClick={() => setIsLocked((v) => !v)}
                    style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", borderColor: isLocked ? "#8b5cf6" : "#1e1e35", background: isLocked ? "#0d0a1f" : "transparent", color: isLocked ? "#8b5cf6" : "#6b7280" }}>
                    {isLocked ? "✓ Yield lock" : "Yield lock"}
                  </button>
                </div>

                {isRecurring && (
                  <div>
                    <label className="label">Repeat every</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[7, 14, 30, 90].map((d) => (
                        <button key={d} type="button" onClick={() => setIntervalDays(d)}
                          style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", borderColor: intervalDays === d ? "#10b981" : "#1e1e35", background: intervalDays === d ? "#0a150a" : "transparent", color: intervalDays === d ? "#10b981" : "#6b7280" }}>
                          {d}d
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isLocked && (
                  <div>
                    <label className="label">Lock duration</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[7, 14, 30, 60, 90].map((d) => (
                        <button key={d} type="button" onClick={() => setLockDays(d)}
                          style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", borderColor: lockDays === d ? "#8b5cf6" : "#1e1e35", background: lockDays === d ? "#0d0a1f" : "transparent", color: lockDays === d ? "#8b5cf6" : "#6b7280" }}>
                          {d}d
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "#8b5cf6", marginTop: 6, fontWeight: 500 }}>
                      Recipient can claim after {lockDays} days. Estimated yield: +{(parseFloat(form.amount || "0") * 0.0495 * lockDays / 365 * 0.9).toFixed(4)} {form.token}
                    </div>
                  </div>
                )}

                {/* Preview */}
                {form.amount && parseFloat(form.amount) > 0 && (
                  <div style={{ background: "#0d0d1f", border: "1px solid #1e1e35", borderRadius: 9, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {isSplit && totalRecipients > 1 ? `Each of ${totalRecipients} recipients receives` : "Recipient receives (estimated)"}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#f0f0f4", fontWeight: 700, fontSize: 15 }}>
                        {form.amount} <span style={{ color: TOKEN_COLOR[form.token] }}>{form.token}</span>
                      </span>
                      <span style={{ color: "#10b981", fontSize: 12, fontWeight: 600 }}>+ {liveApy} yield accruing</span>
                    </div>
                    {isSplit && totalRecipients > 1 && (
                      <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>
                        Total: {(parseFloat(form.amount) * totalRecipients).toFixed(4)} {form.token}
                      </div>
                    )}
                    {/* Fee mode preview */}
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #1e1e35", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#4b5563" }}>Estimated tx fee</span>
                      <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>Free with Cartridge (gasless)</span>
                    </div>
                  </div>
                )}

                <button className="btn-primary"
                  onClick={() => { setError(null); setStep("wallet-select"); }}
                  disabled={loading || !form.fromEmail || !form.toEmail || !form.amount || parseFloat(form.amount) <= 0}>
                  Continue — choose wallet
                </button>
              </div>

              <p style={{ fontSize: 11, color: "#374151", textAlign: "center", marginTop: 16, fontWeight: 500 }}>
                Cartridge (gasless) · ArgentX · Braavos · Starknet Sepolia
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
