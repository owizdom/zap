"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Contact {
  id: string;
  owner_email: string;
  contact_email: string;
  nickname: string | null;
  created_at: number;
}

interface ZapHistory {
  id: string;
  from_email: string;
  to_email: string;
  amount_raw: string;
  token: string;
  status: string;
  created_at: number;
  message: string | null;
}

const TOKEN_COLOR: Record<string, string> = { STRK: "#6366f1", ETH: "#64748b", USDC: "#2563eb" };

function timeAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ContactsPage() {
  const [email, setEmail]             = useState("");
  const [emailInput, setEmailInput]   = useState("");
  const [contacts, setContacts]       = useState<Contact[]>([]);
  const [selected, setSelected]       = useState<Contact | null>(null);
  const [history, setHistory]         = useState<ZapHistory[]>([]);
  const [editNick, setEditNick]       = useState<{ email: string; value: string } | null>(null);
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState("");

  async function loadContacts(ownerEmail: string) {
    setLoading(true);
    const res = await fetch(`/api/contacts?email=${encodeURIComponent(ownerEmail)}`);
    if (res.ok) setContacts(await res.json());
    setLoading(false);
  }

  async function loadHistory(contactEmail: string) {
    if (!email) return;
    const res = await fetch(`/api/contacts?email=${encodeURIComponent(email)}&contact=${encodeURIComponent(contactEmail)}`);
    if (res.ok) {
      const data = await res.json() as { contacts: Contact[]; history: ZapHistory[] };
      setHistory(data.history);
    }
  }

  async function saveNickname() {
    if (!editNick || !email) return;
    await fetch("/api/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerEmail: email, contactEmail: editNick.email, nickname: editNick.value }),
    });
    setEditNick(null);
    loadContacts(email);
  }

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput) return;
    setEmail(emailInput);
    loadContacts(emailInput);
    setSelected(null);
    setHistory([]);
  }

  function selectContact(c: Contact) {
    setSelected(c);
    loadHistory(c.contact_email);
  }

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.contact_email.toLowerCase().includes(q) || (c.nickname || "").toLowerCase().includes(q);
  });

  return (
    <main style={{ minHeight: "100vh", background: "#080810" }}>
      <nav style={{ padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e1e35", background: "#080810", position: "sticky", top: 0, zIndex: 10 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#f0f0f4" }}>
          <span className="logo-mark">Z</span>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>Zapp</span>
        </Link>
        <Link href="/dashboard" style={{ color: "#6b7280", fontSize: 13, textDecoration: "none" }}>Dashboard</Link>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>Contacts</h1>
          <p style={{ color: "#6b7280", fontSize: 13 }}>Auto-built from your transfer history.</p>
        </div>

        {/* Email lookup */}
        <form onSubmit={handleLookup} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <input className="input" type="email" placeholder="Enter your email to view contacts..."
            value={emailInput} onChange={(e) => setEmailInput(e.target.value)} style={{ flex: 1 }} />
          <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>View contacts</button>
        </form>

        {email && (
          <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 16 }}>
            {/* Contact list */}
            <div>
              {contacts.length > 0 && (
                <input className="input" placeholder="Search contacts..." value={search}
                  onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12 }} />
              )}

              {loading ? (
                <div style={{ textAlign: "center", padding: 40, color: "#4b5563", fontSize: 14 }}>Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: "center" }}>
                  <div style={{ color: "#4b5563", fontSize: 14 }}>
                    {contacts.length === 0
                      ? "No contacts yet — send or receive a transfer to add contacts automatically."
                      : "No matches"}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {filtered.map((c) => (
                    <div key={c.id} onClick={() => selectContact(c)}
                      className="card" style={{ padding: "14px 18px", cursor: "pointer",
                        background: selected?.id === c.id ? "#0d0d1f" : "#0f0f1a",
                        border: `1px solid ${selected?.id === c.id ? "#6366f1" : "#1e1e35"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          {c.nickname && (
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0f0f4", marginBottom: 2 }}>{c.nickname}</div>
                          )}
                          <div style={{ fontSize: 13, color: c.nickname ? "#6b7280" : "#f0f0f4" }}>{c.contact_email}</div>
                          <div style={{ fontSize: 11, color: "#374151", marginTop: 3 }}>Added {timeAgo(c.created_at)}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <Link href={`/send?to=${encodeURIComponent(c.contact_email)}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ background: "#6366f120", color: "#818cf8", fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 6, textDecoration: "none", border: "1px solid #6366f130" }}>
                            Send
                          </Link>
                          <button onClick={(e) => { e.stopPropagation(); setEditNick({ email: c.contact_email, value: c.nickname || "" }); }}
                            style={{ background: "#0f0f1a", color: "#4b5563", fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 6, border: "1px solid #1e1e35", cursor: "pointer" }}>
                            {c.nickname ? "Edit" : "Nickname"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History panel */}
            {selected && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f0f4" }}>
                      {selected.nickname || selected.contact_email}
                    </div>
                    {selected.nickname && <div style={{ fontSize: 12, color: "#6b7280" }}>{selected.contact_email}</div>}
                  </div>
                  <button onClick={() => { setSelected(null); setHistory([]); }}
                    style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: 18 }}>×</button>
                </div>

                {/* Nickname editor */}
                {editNick?.email === selected.contact_email && (
                  <div style={{ background: "#0f0f1a", border: "1px solid #1e1e35", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                    <label className="label">Nickname</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input className="input" value={editNick.value}
                        onChange={(e) => setEditNick({ ...editNick, value: e.target.value })}
                        placeholder="e.g. Alice from work" style={{ flex: 1 }} />
                      <button onClick={saveNickname} className="btn-primary" style={{ flexShrink: 0 }}>Save</button>
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 12, color: "#4b5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                  Transfer history
                </div>
                {history.length === 0 ? (
                  <div className="card" style={{ padding: 24, textAlign: "center", color: "#4b5563", fontSize: 13 }}>
                    No transfers yet
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {history.map((h) => {
                      const isSent = h.from_email === email;
                      const tokenColor = TOKEN_COLOR[h.token] ?? "#6366f1";
                      return (
                        <div key={h.id} className="card" style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: isSent ? "#f87171" : "#10b981" }}>
                                {isSent ? "Sent" : "Received"}
                              </span>
                              <span style={{ fontSize: 11, color: "#4b5563", marginLeft: 8 }}>{timeAgo(h.created_at)}</span>
                              {h.message && (
                                <div style={{ fontSize: 11, color: "#4b5563", marginTop: 3, fontStyle: "italic" }}>&ldquo;{h.message}&rdquo;</div>
                              )}
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: tokenColor }}>
                                {isSent ? "-" : "+"} {h.token}
                              </div>
                              <div style={{ fontSize: 11, color: "#4b5563" }}>{h.status}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
