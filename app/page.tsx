import Link from "next/link";
import { LiveStats } from "./components/LiveStats";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <nav style={{ padding: "0 32px", height: 56, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e1e35", background: "#080810" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="logo-mark">Z</span>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>Zapp</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Link href="/stream" className="nav-link" style={{ color: "#38bdf8" }}>Stream</Link>
          <Link href="/request" className="nav-link">Request</Link>
          <Link href="/contacts" className="nav-link">Contacts</Link>
          <Link href="/dashboard" className="nav-link">Dashboard</Link>
          <Link href="/send" style={{ background: "#6366f1", color: "#fff", fontWeight: 600, padding: "7px 16px", borderRadius: 8, textDecoration: "none", fontSize: 14 }}>
            Send Transfer
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "96px 24px 72px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0f0f1a", border: "1px solid #1e1e35", borderRadius: 999, padding: "5px 14px", fontSize: 12, color: "#9ca3af", marginBottom: 28, fontWeight: 500, letterSpacing: "0.02em" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
          Built on Starknet · StarkZap SDK · Real staking yield
        </div>

        <h1 style={{ fontSize: "clamp(38px, 7vw, 72px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.04em", margin: "0 0 24px", maxWidth: 760, color: "#f0f0f4" }}>
          Send crypto to anyone&apos;s email.{" "}
          <span style={{ color: "#6366f1" }}>It earns real yield while they wait.</span>
        </h1>

        <p style={{ fontSize: "clamp(16px, 2vw, 18px)", color: "#6b7280", maxWidth: 520, lineHeight: 1.65, marginBottom: 40 }}>
          STRK, ETH, or USDC — no wallet needed to receive. Recipients sign in with Google and claim their funds plus all the yield that accrued from real Starknet validators.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/send" style={{ background: "#6366f1", color: "#fff", fontWeight: 700, padding: "14px 28px", borderRadius: 10, textDecoration: "none", fontSize: 15, letterSpacing: "-0.01em" }}>
            Send Transfer
          </Link>
          <Link href="/request" style={{ background: "#1a1400", color: "#f59e0b", fontWeight: 600, padding: "14px 28px", borderRadius: 10, textDecoration: "none", fontSize: 15, border: "1px solid #3a2800" }}>
            Request Money
          </Link>
          <Link href="/stream" style={{ background: "#0a1020", color: "#38bdf8", fontWeight: 600, padding: "14px 28px", borderRadius: 10, textDecoration: "none", fontSize: 15, border: "1px solid #1a3a60" }}>
            Stream Salary
          </Link>
          <a href="#how" style={{ background: "#0f0f1a", color: "#9ca3af", fontWeight: 600, padding: "14px 28px", borderRadius: 10, textDecoration: "none", fontSize: 15, border: "1px solid #1e1e35" }}>
            How it works
          </a>
        </div>
      </section>

      {/* Live Stats + Activity */}
      <LiveStats />

      {/* Features grid */}
      <section style={{ padding: "0 24px 80px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8, color: "#f0f0f4" }}>
          Everything you need
        </h2>
        <p style={{ textAlign: "center", color: "#6b7280", fontSize: 14, marginBottom: 32 }}>One protocol. Every payment flow.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {[
            { icon: "01", title: "Email transfers", desc: "Send STRK, ETH, or USDC to any email. Recipient claims with Google login — no wallet needed." },
            { icon: "02", title: "Real staking yield", desc: "Funds earn live APY from Starknet validators while unclaimed. Not simulated — real on-chain yield rates." },
            { icon: "03", title: "Request money", desc: "Generate a payment request link and send it to anyone. They pay via Zapp, you claim with yield." },
            { icon: "04", title: "Recurring transfers", desc: "Set up recurring payments — weekly, biweekly, monthly. Perfect for payroll, allowances, subscriptions." },
            { icon: "05", title: "Salary streaming", desc: "Tokens drip per second. First salary streaming on Starknet — employer sets total & duration, employee claims anytime." },
            { icon: "06", title: "Subscription payments", desc: "Merchant creates a plan, subscriber authorizes once. Collect recurring payments gaslessly on-chain." },
            { icon: "07", title: "Split payments", desc: "Send to multiple emails in one transaction. Each recipient gets their share plus yield." },
            { icon: "08", title: "Contact book", desc: "Auto-populated from your transfer history. Set nicknames and view full payment history per contact." },
            { icon: "09", title: "AI quick-fill", desc: 'Type naturally: "Send 10 STRK to alice@gmail.com for dinner" and the form fills itself.' },
          ].map((f) => (
            <div key={f.title} className="card" style={{ padding: "20px 22px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#6366f1", letterSpacing: "0.05em", marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: "#f0f0f4" }}>{f.title}</div>
              <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ padding: "0 24px 80px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8, color: "#f0f0f4" }}>
          How it works
        </h2>
        <p style={{ textAlign: "center", color: "#6b7280", fontSize: 14, marginBottom: 40 }}>Three steps. Under a minute.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { step: "01", title: "Send a transfer", desc: "Enter recipient's email, amount, and token (STRK, ETH, USDC). Connect your Cartridge wallet — gasless by default." },
            { step: "02", title: "Funds earn real yield", desc: "Your crypto earns live APY from Starknet staking validators. The longer they wait to claim, the more they receive." },
            { step: "03", title: "Recipient claims", desc: "They get an email with a claim link. Sign in with Google, enter a Starknet address, and funds transfer instantly with full yield breakdown." },
          ].map((item) => (
            <div key={item.step} className="card" style={{ padding: "22px 24px", display: "flex", gap: 18, alignItems: "flex-start" }}>
              <div style={{ background: "#6366f1", color: "#fff", borderRadius: 8, padding: "6px 12px", fontWeight: 800, fontSize: 12, flexShrink: 0, letterSpacing: "0.02em" }}>
                {item.step}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "#f0f0f4" }}>{item.title}</div>
                <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Protocol fee callout */}
      <section style={{ padding: "0 24px 80px", maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <div className="card" style={{ padding: "24px 28px" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "#f0f0f4" }}>Transparent protocol fee</div>
            <div style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.6 }}>
              10% of yield goes to the Zapp protocol — not from your principal, only from yield earned. Every claim shows the full breakdown: principal, gross yield, fee deducted, net yield received.
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #1e1e35", padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#374151", fontSize: 12, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontWeight: 700, color: "#6b7280" }}>Zapp</span>
        <div style={{ display: "flex", gap: 16 }}>
          <Link href="/send" style={{ color: "#4b5563", textDecoration: "none" }}>Send</Link>
          <Link href="/request" style={{ color: "#4b5563", textDecoration: "none" }}>Request</Link>
          <Link href="/stream" style={{ color: "#4b5563", textDecoration: "none" }}>Stream</Link>
          <Link href="/contacts" style={{ color: "#4b5563", textDecoration: "none" }}>Contacts</Link>
          <Link href="/dashboard" style={{ color: "#4b5563", textDecoration: "none" }}>Dashboard</Link>
        </div>
        <span>Starknet · StarkZap SDK</span>
      </footer>
    </main>
  );
}
