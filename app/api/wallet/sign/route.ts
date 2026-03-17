import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/wallet/sign
 *
 * Backend signing endpoint for Privy-managed Starknet wallets.
 * The PrivySigner in starkzap SDK calls this endpoint to sign transaction hashes.
 *
 * In production, this would call Privy's server-side rawSign API.
 * Requires PRIVY_APP_SECRET env var for authentication with Privy.
 */
export async function POST(req: NextRequest) {
  try {
    const { walletId, hash } = (await req.json()) as { walletId: string; hash: string };

    if (!walletId || !hash) {
      return NextResponse.json({ error: "walletId and hash are required" }, { status: 400 });
    }

    const appSecret = process.env.PRIVY_APP_SECRET;
    if (!appSecret) {
      return NextResponse.json({ error: "Privy server auth not configured" }, { status: 503 });
    }

    // Call Privy's server-side signing API
    // Uses @privy-io/server-auth PrivyClient under the hood
    const { PrivyClient } = await import("@privy-io/server-auth");
    const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    if (!privyAppId) {
      return NextResponse.json({ error: "Privy app ID not configured" }, { status: 503 });
    }

    const privy = new PrivyClient(privyAppId, appSecret);
    const response = await (privy as unknown as {
      walletApi: {
        rpc: (params: { walletId: string; method: string; params: { hash: string } }) => Promise<{ data: { signature: string } }>;
      };
    }).walletApi.rpc({
      walletId,
      method: "stark_sign",
      params: { hash },
    });

    return NextResponse.json({ signature: response.data.signature });
  } catch (err) {
    console.error("[POST /api/wallet/sign]", err);
    return NextResponse.json(
      { error: "Signing failed" },
      { status: 500 }
    );
  }
}
