"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useRef, useEffect, useMemo } from "react";

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSend = (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || isLoading) return;
    sendMessage({ text: msg });
    setInput("");
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 24px rgba(99,102,241,0.4)",
          zIndex: 1000,
          transition: "transform 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <span style={{ fontSize: 24, color: "#fff", fontWeight: 800 }}>
          {open ? "\u2715" : "AI"}
        </span>
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 92,
            right: 24,
            width: 400,
            maxWidth: "calc(100vw - 48px)",
            height: 520,
            maxHeight: "calc(100vh - 120px)",
            background: "#0c0c18",
            border: "1px solid #1e1e35",
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            zIndex: 999,
            boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #1e1e35",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#0a0a14",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f0f4" }}>
                Zapp AI
              </div>
              <div style={{ fontSize: 11, color: "#4b5563" }}>
                Ask about balances, transfers, yield, staking
              </div>
            </div>
            <button
              onClick={() => setMessages([])}
              style={{
                background: "transparent",
                border: "1px solid #1e1e35",
                color: "#4b5563",
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Clear
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {messages.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12, color: "#6366f1", fontWeight: 900 }}>Z</div>
                <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
                  Try asking:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    "What's my STRK balance?",
                    "Show my recent transfers",
                    "What's the current staking APY?",
                    "How much yield on 100 STRK for 30 days?",
                    "Show my staking position",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      style={{
                        background: "#111122",
                        border: "1px solid #1e1e35",
                        color: "#9ca3af",
                        padding: "8px 14px",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 12,
                        textAlign: "left",
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => {
                let text = "";
                if (m.parts && m.parts.length > 0) {
                  text = m.parts
                    .filter((p: any) => p.type === "text")
                    .map((p: any) => p.text || "")
                    .join("");
                }
                if (!text && (m as any).content) {
                  text = (m as any).content;
                }
                if (!text) return null;
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        background: m.role === "user" ? "#6366f1" : "#161625",
                        color: m.role === "user" ? "#fff" : "#e5e7eb",
                        fontSize: 13,
                        lineHeight: 1.5,
                        border: m.role === "user" ? "none" : "1px solid #1e1e35",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {text}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#374151",
                        marginTop: 4,
                        textAlign: m.role === "user" ? "right" : "left",
                      }}
                    >
                      {m.role === "user" ? "You" : "Zapp AI"}
                    </div>
                  </div>
                );
              })}

            {isLoading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: "10px 14px",
                  borderRadius: "14px 14px 14px 4px",
                  background: "#161625",
                  border: "1px solid #1e1e35",
                  fontSize: 13,
                  color: "#6366f1",
                }}
              >
                Thinking...
              </div>
            )}

            <div ref={messagesEnd} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            style={{
              padding: "12px 16px",
              borderTop: "1px solid #1e1e35",
              display: "flex",
              gap: 8,
              background: "#0a0a14",
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Zapp AI anything..."
              disabled={isLoading}
              style={{
                flex: 1,
                background: "#111122",
                border: "1px solid #1e1e35",
                borderRadius: 10,
                padding: "10px 14px",
                color: "#f0f0f4",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                background: input.trim() ? "#6366f1" : "#1e1e35",
                border: "none",
                borderRadius: 10,
                padding: "10px 16px",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: input.trim() ? "pointer" : "default",
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
