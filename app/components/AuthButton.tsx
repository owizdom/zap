"use client";

import { useSession, signIn, signOut } from "next-auth/react";
export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1e1e35", animation: "pulse 1.5s infinite" }} />
    );
  }

  if (session?.user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {session.user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt={session.user.name ?? ""}
            width={28}
            height={28}
            style={{ borderRadius: "50%", border: "1px solid #1e1e35" }}
          />
        )}
        <span style={{ fontSize: 12, color: "#9ca3af", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {session.user.email}
        </span>
        <button
          onClick={() => signOut()}
          style={{ background: "none", border: "1px solid #1e1e35", borderRadius: 6, color: "#4b5563", fontSize: 11, padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("google")}
      style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", color: "#111", fontWeight: 600, fontSize: 13, padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer" }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Sign in with Google
    </button>
  );
}
