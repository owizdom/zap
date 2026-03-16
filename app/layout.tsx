import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./components/providers";

export const metadata: Metadata = {
  title: "Zapp — Send crypto to anyone",
  description: "Send STRK, ETH, or USDC to anyone's email. Funds earn real staking yield while they wait. No wallet required to receive.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Zap",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Zapp — Send crypto to anyone's email",
    description: "Funds earn real Starknet staking yield while unclaimed. No wallet needed to receive.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#080810",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
