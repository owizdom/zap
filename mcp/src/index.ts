#!/usr/bin/env node
/**
 * Zapp MCP Server
 *
 * Model Context Protocol server for Zapp — the email-native crypto transfer
 * app on Starknet. Exposes 20 tools that let AI agents send crypto, manage
 * streams, subscriptions, recurring transfers, check balances, and more.
 *
 * Usage:  ZAPP_API_URL=https://zapp-five.vercel.app npx tsx src/index.ts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_URL = (process.env.ZAPP_API_URL || "https://zapp-five.vercel.app").replace(/\/+$/, "");
const API_KEY = process.env.ZAPP_API_KEY || "";

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

interface FetchOpts {
  method?: string;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}

async function api<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { method = "GET", body, params } = opts;

  let url = `${API_URL}${path}`;
  if (params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") sp.set(k, v);
    }
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let errMsg: string;
    if (contentType.includes("application/json")) {
      const errJson = (await res.json()) as { error?: string };
      errMsg = errJson.error || res.statusText;
    } else {
      errMsg = await res.text();
    }
    throw new Error(`API ${res.status}: ${errMsg}`);
  }

  if (contentType.includes("text/csv")) {
    return (await res.text()) as unknown as T;
  }

  return (await res.json()) as T;
}

function ok(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(msg: string): { content: Array<{ type: "text"; text: string }>; isError: true } {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
}

// ---------------------------------------------------------------------------
// Token enum shared across tools
// ---------------------------------------------------------------------------

const TokenEnum = z.enum(["STRK", "ETH", "USDC"]).default("STRK")
  .describe("Token symbol. Zapp supports STRK, ETH, and USDC on Starknet.");

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "zapp",
  version: "1.0.0",
});

// ==========================================================================
// 1. send_zap — Send crypto to an email address
// ==========================================================================

server.tool(
  "send_zap",
  "Send STRK, ETH, or USDC to any email address via Zapp. The recipient gets an email with a claim link and the funds earn staking yield while unclaimed.",
  {
    from_email: z.string().email().describe("Sender's email address"),
    to_email: z.string().email().describe("Recipient's email address"),
    amount: z.string().describe("Amount to send (human-readable, e.g. '10.5')"),
    token: TokenEnum,
    message: z.string().optional().describe("Optional message included in the claim email"),
    tx_hash: z.string().optional().describe("On-chain transaction hash if the deposit was already made"),
  },
  async ({ from_email, to_email, amount, token, message, tx_hash }) => {
    try {
      const data = await api("/api/zap", {
        method: "POST",
        body: {
          fromEmail: from_email,
          toEmail: to_email,
          amount,
          token,
          message,
          txHash: tx_hash,
        },
      });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 2. check_zap — Check status of a transfer
// ==========================================================================

server.tool(
  "check_zap",
  "Look up a Zap transfer by its ID. Returns status (funded/claimed/refunded), yield accrued, APY, sender, recipient, and more.",
  {
    zap_id: z.string().uuid().describe("The unique Zap transfer ID"),
  },
  async ({ zap_id }) => {
    try {
      const data = await api(`/api/zap/${zap_id}`);
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 3. list_transfers — List all transfers
// ==========================================================================

server.tool(
  "list_transfers",
  "List all Zap transfers with computed yield. Each transfer includes amount, yield earned, total value, status, sender/recipient emails, and APY.",
  {},
  async () => {
    try {
      const data = await api("/api/zaps");
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 4. create_payment_request — Request a payment
// ==========================================================================

server.tool(
  "create_payment_request",
  "Create a payment request link. Optionally send the request to a specific email. Returns a pay URL that anyone can use to fulfill the request.",
  {
    from_email: z.string().email().describe("Email of the person requesting payment (you)"),
    to_email: z.string().email().optional().describe("Email of the person you're requesting payment from"),
    amount: z.string().describe("Requested amount (human-readable, e.g. '25')"),
    token: TokenEnum,
    message: z.string().optional().describe("Optional note (e.g. 'Dinner last night')"),
  },
  async ({ from_email, to_email, amount, token, message }) => {
    try {
      const data = await api<{ id: string; payUrl: string }>("/api/request", {
        method: "POST",
        body: { fromEmail: from_email, toEmail: to_email, amount, token, message },
      });
      return ok({ ...data, fullPayUrl: `${API_URL}${data.payUrl}` });
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 5. get_payment_request — Check a payment request
// ==========================================================================

server.tool(
  "get_payment_request",
  "Look up a payment request by ID. Returns status (pending/paid/cancelled), amount, token, involved parties, and the linked zap ID if paid.",
  {
    request_id: z.string().uuid().describe("The payment request ID"),
  },
  async ({ request_id }) => {
    try {
      const data = await api(`/api/request/${request_id}`);
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 6. list_payment_requests — List all payment requests
// ==========================================================================

server.tool(
  "list_payment_requests",
  "List all payment requests. Returns an array of requests with status, amount, token, sender/recipient, and timestamps.",
  {},
  async () => {
    try {
      const data = await api("/api/request");
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 7. create_stream — Create a salary/payment stream
// ==========================================================================

server.tool(
  "create_stream",
  "Create a continuous payment stream that drips tokens to a recipient over a set duration. Useful for salaries, grants, or vesting schedules. The recipient can claim accrued tokens at any time.",
  {
    from_email: z.string().email().describe("Sender's email (stream creator)"),
    to_email: z.string().email().describe("Recipient's email (stream beneficiary)"),
    total_amount: z.string().describe("Total amount to stream over the full duration (e.g. '1000')"),
    token: TokenEnum,
    duration_days: z.number().int().min(1).describe("Stream duration in days (e.g. 30 for one month)"),
    message: z.string().optional().describe("Optional note (e.g. 'March salary')"),
  },
  async ({ from_email, to_email, total_amount, token, duration_days, message }) => {
    try {
      const data = await api("/api/stream", {
        method: "POST",
        body: {
          fromEmail: from_email,
          toEmail: to_email,
          totalAmount: total_amount,
          token,
          durationDays: duration_days,
          message,
        },
      });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 8. get_stream — Get stream details and claimable amount
// ==========================================================================

server.tool(
  "get_stream",
  "Get detailed info about a payment stream including claimable amount, progress percentage, total streamed, amount per second, and whether the stream is complete.",
  {
    stream_id: z.string().uuid().describe("The stream ID"),
  },
  async ({ stream_id }) => {
    try {
      const data = await api(`/api/stream/${stream_id}`);
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 9. list_streams — List all streams
// ==========================================================================

server.tool(
  "list_streams",
  "List all payment streams. Returns an array of streams with sender, recipient, token, total amount, duration, and active status.",
  {},
  async () => {
    try {
      const data = await api("/api/stream");
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 10. claim_stream — Claim accrued tokens from a stream
// ==========================================================================

server.tool(
  "claim_stream",
  "Claim tokens that have accrued in a payment stream. Sends the claimable amount to the provided Starknet address. Returns the transaction hash and amount claimed.",
  {
    stream_id: z.string().uuid().describe("The stream ID to claim from"),
    recipient_address: z.string().describe("Starknet address (0x...) to receive the tokens"),
  },
  async ({ stream_id, recipient_address }) => {
    try {
      const data = await api(`/api/stream/${stream_id}/claim`, {
        method: "POST",
        body: { recipientAddress: recipient_address },
      });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 11. create_subscription — Create a subscription plan
// ==========================================================================

server.tool(
  "create_subscription",
  "Create a recurring subscription plan. Returns a subscribe URL that customers can use to authorize the subscription. Useful for SaaS billing, memberships, or any recurring charge.",
  {
    merchant_email: z.string().email().describe("Merchant/creator email who receives payments"),
    subscriber_email: z.string().email().optional().describe("Optional: subscriber email to notify immediately"),
    amount: z.string().describe("Amount per billing cycle (e.g. '9.99')"),
    token: TokenEnum,
    interval_days: z.number().int().min(1).default(30).describe("Billing interval in days (default: 30)"),
    description: z.string().optional().describe("Plan description (e.g. 'Pro Plan - Monthly')"),
  },
  async ({ merchant_email, subscriber_email, amount, token, interval_days, description }) => {
    try {
      const data = await api<{ id: string; subscribeUrl: string }>("/api/subscription", {
        method: "POST",
        body: {
          merchantEmail: merchant_email,
          subscriberEmail: subscriber_email,
          amount,
          token,
          intervalDays: interval_days,
          description,
        },
      });
      return ok({ ...data, fullSubscribeUrl: `${API_URL}${data.subscribeUrl}` });
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 12. get_subscription — Get subscription details
// ==========================================================================

server.tool(
  "get_subscription",
  "Get details of a subscription plan including amount, token, interval, active status, subscriber info, and next pull date.",
  {
    subscription_id: z.string().uuid().describe("The subscription ID"),
  },
  async ({ subscription_id }) => {
    try {
      const data = await api(`/api/subscription/${subscription_id}`);
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 13. list_subscriptions — List all subscriptions
// ==========================================================================

server.tool(
  "list_subscriptions",
  "List all subscription plans. Returns an array with plan details, active status, subscriber info, and billing schedule.",
  {},
  async () => {
    try {
      const data = await api("/api/subscription");
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 14. cancel_subscription — Cancel a subscription
// ==========================================================================

server.tool(
  "cancel_subscription",
  "Cancel an active subscription. No further payments will be collected after cancellation.",
  {
    subscription_id: z.string().uuid().describe("The subscription ID to cancel"),
  },
  async ({ subscription_id }) => {
    try {
      const data = await api(`/api/subscription/${subscription_id}/collect`, { method: "DELETE" });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 15. create_recurring — Create a recurring transfer
// ==========================================================================

server.tool(
  "create_recurring",
  "Set up an automatic recurring transfer that sends crypto to an email on a schedule. Useful for rent, allowances, or regular payments. Each execution creates a new claimable Zap.",
  {
    from_email: z.string().email().describe("Sender's email"),
    to_email: z.string().email().describe("Recipient's email"),
    amount: z.string().describe("Amount per transfer (e.g. '100')"),
    token: TokenEnum,
    interval_days: z.number().int().min(1).default(30).describe("Days between transfers (default: 30)"),
    message: z.string().optional().describe("Optional recurring message"),
  },
  async ({ from_email, to_email, amount, token, interval_days, message }) => {
    try {
      const data = await api("/api/recurring", {
        method: "POST",
        body: {
          fromEmail: from_email,
          toEmail: to_email,
          amount,
          token,
          intervalDays: interval_days,
          message,
        },
      });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 16. list_recurring — List all recurring transfers
// ==========================================================================

server.tool(
  "list_recurring",
  "List all recurring transfer schedules. Shows sender, recipient, amount, token, interval, next execution time, and active status.",
  {},
  async () => {
    try {
      const data = await api("/api/recurring");
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 17. cancel_recurring — Cancel a recurring transfer
// ==========================================================================

server.tool(
  "cancel_recurring",
  "Cancel an active recurring transfer schedule. No further transfers will be created after cancellation.",
  {
    recurring_id: z.string().uuid().describe("The recurring transfer ID to cancel"),
  },
  async ({ recurring_id }) => {
    try {
      const data = await api(`/api/recurring/${recurring_id}`, { method: "DELETE" });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 18. get_balance — Get escrow wallet balance
// ==========================================================================

server.tool(
  "get_balance",
  "Get the current balance of the Zapp escrow wallet for a specific token. The escrow holds all deposited funds and staking rewards.",
  {
    token: TokenEnum,
  },
  async ({ token }) => {
    try {
      const data = await api("/api/balance", { params: { token } });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 19. get_staking_position — Get staking info
// ==========================================================================

server.tool(
  "get_staking_position",
  "Get the current STRK staking position including staked amount, pending rewards, total value, APY percentage, validator info, commission rate, unpooling status, and active staking tokens.",
  {},
  async () => {
    try {
      const data = await api("/api/stake");
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 20. get_apy — Get current staking APY
// ==========================================================================

server.tool(
  "get_apy",
  "Get the current live staking APY (Annual Percentage Yield) for STRK and the active validator. Useful for yield estimates.",
  {},
  async () => {
    try {
      const data = await api("/api/apy");
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 21. get_contacts — List contacts from transfer history
// ==========================================================================

server.tool(
  "get_contacts",
  "Get contacts derived from transfer history for a given email address. Optionally get full transaction history with a specific contact.",
  {
    email: z.string().email().describe("Your email address to look up contacts for"),
    contact: z.string().email().optional().describe("Optional: specific contact email to get transaction history with"),
  },
  async ({ email, contact }) => {
    try {
      const params: Record<string, string> = { email };
      if (contact) params.contact = contact;
      const data = await api("/api/contacts", { params });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 22. set_contact_nickname — Set a nickname for a contact
// ==========================================================================

server.tool(
  "set_contact_nickname",
  "Set a friendly nickname for a contact email address. Makes it easier to identify frequent transfer partners.",
  {
    owner_email: z.string().email().describe("Your email address"),
    contact_email: z.string().email().describe("The contact's email address"),
    nickname: z.string().min(1).describe("Nickname to assign (e.g. 'Alice', 'Landlord')"),
  },
  async ({ owner_email, contact_email, nickname }) => {
    try {
      const data = await api("/api/contacts", {
        method: "PATCH",
        body: { ownerEmail: owner_email, contactEmail: contact_email, nickname },
      });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 23. export_transfers — Export transfer history as CSV
// ==========================================================================

server.tool(
  "export_transfers",
  "Export all transfer history as a CSV string. Includes ID, sender, recipient, amount, token, status, yield earned, protocol fee, APY, timestamps, TX hash, and message for every Zap.",
  {},
  async () => {
    try {
      const csv = await api<string>("/api/export");
      return { content: [{ type: "text" as const, text: csv }] };
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 24. get_yield_estimate — Calculate estimated yield
// ==========================================================================

server.tool(
  "get_yield_estimate",
  "Calculate the estimated staking yield for a given amount over a specified duration. Uses the live APY from the Starknet validator. Factors in Zapp's 10% protocol fee on yield.",
  {
    amount: z.string().describe("Amount in human-readable form (e.g. '1000')"),
    duration_days: z.number().min(1).describe("How many days the funds would earn yield"),
    token: TokenEnum,
  },
  async ({ amount, duration_days, token }) => {
    try {
      // Fetch live APY
      const apyData = await api<{ apy: number; apyPercent: string; validator: string }>("/api/apy");
      const apy = apyData.apy;
      const amountNum = parseFloat(amount);

      if (isNaN(amountNum) || amountNum <= 0) {
        return err("Amount must be a positive number");
      }

      const durationYears = duration_days / 365;
      const grossYield = amountNum * apy * durationYears;
      const protocolFee = grossYield * 0.1; // 10% protocol fee
      const netYield = grossYield - protocolFee;
      const totalValue = amountNum + netYield;

      return ok({
        amount,
        token,
        duration_days,
        apy: apyData.apyPercent,
        validator: apyData.validator,
        gross_yield: grossYield.toFixed(6),
        protocol_fee: protocolFee.toFixed(6),
        net_yield: netYield.toFixed(6),
        total_value: totalValue.toFixed(6),
        note: "Yield is earned on STRK deposits via Starknet staking. ETH and USDC amounts shown for reference but may not earn staking yield.",
      });
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 25. resend_claim_email — Resend the claim email for a Zap
// ==========================================================================

server.tool(
  "resend_claim_email",
  "Resend the claim notification email for a pending Zap transfer. Useful if the recipient didn't receive or can't find the original email.",
  {
    zap_id: z.string().uuid().describe("The Zap transfer ID to resend the email for"),
  },
  async ({ zap_id }) => {
    try {
      const data = await api(`/api/zap/${zap_id}/resend`, { method: "POST" });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 26. claim_zap — Claim a Zap transfer
// ==========================================================================

server.tool(
  "claim_zap",
  "Claim a pending Zap transfer. Sends the original amount plus accrued yield to the specified Starknet address. Returns the transaction hash, breakdown of amount, yield, and protocol fee.",
  {
    zap_id: z.string().uuid().describe("The Zap transfer ID to claim"),
    recipient_address: z.string().describe("Starknet address (0x...) to receive the tokens"),
  },
  async ({ zap_id, recipient_address }) => {
    try {
      const data = await api(`/api/zap/${zap_id}/claim`, {
        method: "POST",
        body: { recipientAddress: recipient_address },
      });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 27. authorize_subscription — Authorize a subscription as a subscriber
// ==========================================================================

server.tool(
  "authorize_subscription",
  "Authorize a subscription plan as a subscriber. This activates the subscription and sets the first payment date.",
  {
    subscription_id: z.string().uuid().describe("The subscription plan ID to authorize"),
    subscriber_email: z.string().email().describe("The subscriber's email address"),
  },
  async ({ subscription_id, subscriber_email }) => {
    try {
      const data = await api(`/api/subscription/${subscription_id}/authorize`, {
        method: "POST",
        body: { subscriberEmail: subscriber_email },
      });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 28. collect_subscription — Collect a due subscription payment
// ==========================================================================

server.tool(
  "collect_subscription",
  "Collect a due subscription payment. Only works if the subscription is active and the billing date has passed. Sends funds to the specified Starknet address.",
  {
    subscription_id: z.string().uuid().describe("The subscription ID to collect payment for"),
    recipient_address: z.string().describe("Starknet address (0x...) of the merchant to receive payment"),
  },
  async ({ subscription_id, recipient_address }) => {
    try {
      const data = await api(`/api/subscription/${subscription_id}/collect`, {
        method: "POST",
        body: { recipientAddress: recipient_address },
      });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 29. trigger_recurring — Process all due recurring transfers
// ==========================================================================

server.tool(
  "trigger_recurring",
  "Process all due recurring transfers. Creates new Zap transfers and sends claim emails for any recurring schedules that are past their next execution time. Returns the number triggered and their Zap IDs.",
  {},
  async () => {
    try {
      const data = await api("/api/recurring/trigger", { method: "POST" });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ==========================================================================
// 30. pay_request — Pay a payment request
// ==========================================================================

server.tool(
  "pay_request",
  "Fulfill a payment request by paying it. Creates a Zap transfer from the payer to the requester. The requester receives a claim email for the funds.",
  {
    request_id: z.string().uuid().describe("The payment request ID to pay"),
    tx_hash: z.string().optional().describe("On-chain transaction hash if the deposit was already made"),
  },
  async ({ request_id, tx_hash }) => {
    try {
      const data = await api(`/api/request/${request_id}/pay`, {
        method: "POST",
        body: { txHash: tx_hash },
      });
      return ok(data);
    } catch (e: any) {
      return err(e.message);
    }
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Zapp MCP server running (${API_URL}) — 30 tools available`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
