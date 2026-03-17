"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

/**
 * Wraps children with PrivyProvider for social-login wallet creation.
 * Gracefully renders children without Privy if NEXT_PUBLIC_PRIVY_APP_ID is not set.
 */
export default function PrivyProviderWrapper({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID) {
    return <>{children}</>;
  }

  return (
    <BasePrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#6366f1",
        },
        loginMethods: ["google", "email"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "all-users",
          },
        },
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}
