// @ts-nocheck
import { streamText, tool } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
import { getAllZaps } from "@/lib/db";
import { calcYield, calcProtocolFee, formatToken } from "@/lib/yield";
import {
  getEscrowBalance,
  getLiveApy,
  getStakingPosition,
  getActiveStakingTokens,
  getValidatorInfo,
} from "@/lib/escrow";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: groq("llama-3.3-70b-versatile"),
    system: `You are the Zapp AI assistant — a helpful agent for Zapp, an email-native crypto transfer platform on Starknet.

You can check balances, staking positions, APY rates, list transfers/streams/requests, and answer questions about Zapp.

When presenting data:
- Format numbers cleanly (e.g. "42.5 STRK" not "42.500000")
- Use simple language, no jargon
- Be concise — short answers are better
- If a user asks to send/transfer, tell them to use the Send page at /send since it requires wallet signing

You have access to real on-chain data through your tools. Always use tools to get current data rather than guessing.`,
    messages,
    tools: {
      getBalance: tool({
        description: "Get the escrow wallet balance for a specific token (STRK, ETH, or USDC)",
        parameters: z.object({
          token: z.enum(["STRK", "ETH", "USDC"]).describe("Token symbol"),
        }),
        execute: async (params: { token?: string } | null) => {
          const token = params?.token || "STRK";
          const balance = await getEscrowBalance(token);
          return { balance, token };
        },
      }),

      getApy: tool({
        description: "Get the current live staking APY and validator info",
        parameters: z.object({
          _unused: z.string().optional().describe("Not used"),
        }),
        execute: async () => {
          const apy = await getLiveApy();
          const validator = getValidatorInfo();
          return {
            apy,
            apyPercent: `${(apy * 100).toFixed(2)}%`,
            validator: validator.name,
          };
        },
      }),

      getStakingPosition: tool({
        description: "Get the current staking position including staked amount, rewards, APY, and active tokens",
        parameters: z.object({
          _unused: z.string().optional().describe("Not used"),
        }),
        execute: async () => {
          const [position, apy, activeTokens] = await Promise.all([
            getStakingPosition(),
            getLiveApy(),
            getActiveStakingTokens(),
          ]);
          const validator = getValidatorInfo();
          return {
            validator: validator.name,
            staked: position?.staked.toFormatted() ?? "0",
            rewards: position?.rewards.toFormatted() ?? "0",
            total: position?.total.toFormatted() ?? "0",
            unpooling: position?.unpooling.toFormatted() ?? "0",
            apy,
            apyPercent: `${(apy * 100).toFixed(2)}%`,
            activeTokens: activeTokens.map((t) => t.symbol),
          };
        },
      }),

      listTransfers: tool({
        description: "List all transfers (zaps) with their status, amounts, yield earned, and recipient info",
        parameters: z.object({
          limit: z.number().describe("Max number of transfers to return"),
        }),
        execute: async (params: { limit?: number } | null) => {
          const zaps = await getAllZaps();
          const count = params?.limit || 10;
          return zaps.slice(0, count).map((z) => {
            const apy = z.yield_apy ?? 0.05;
            const yieldGross = z.status === "claimed" ? 0n : calcYield(z.amount_raw, z.created_at, apy);
            const protocolFee = calcProtocolFee(yieldGross);
            const yieldEarned = yieldGross - protocolFee;
            return {
              id: z.id.slice(0, 8),
              from: z.from_email,
              to: z.to_email,
              amount: formatToken(BigInt(z.amount_raw), z.token),
              yield: formatToken(yieldEarned, z.token),
              token: z.token,
              status: z.status,
              type: z.type,
              message: z.message,
              createdAt: new Date(z.created_at).toLocaleDateString(),
            };
          });
        },
      }),

      getTransferStats: tool({
        description: "Get summary statistics for all transfers: total sent, total yield, counts by status",
        parameters: z.object({
          _unused: z.string().optional().describe("Not used"),
        }),
        execute: async () => {
          const zaps = await getAllZaps();
          let totalSent = 0;
          let totalYield = 0;
          let pending = 0;
          let funded = 0;
          let claimed = 0;
          let refunded = 0;

          for (const z of zaps) {
            totalSent += parseFloat(formatToken(BigInt(z.amount_raw), z.token));
            if (z.status !== "claimed") {
              const yieldGross = calcYield(z.amount_raw, z.created_at, z.yield_apy ?? 0.05);
              const fee = calcProtocolFee(yieldGross);
              totalYield += parseFloat(formatToken(yieldGross - fee, z.token));
            }
            if (z.status === "pending") pending++;
            if (z.status === "funded") funded++;
            if (z.status === "claimed") claimed++;
            if (z.status === "refunded") refunded++;
          }

          return {
            totalTransfers: zaps.length,
            totalSent: totalSent.toFixed(4),
            totalYieldAccrued: totalYield.toFixed(6),
            pending,
            funded,
            claimed,
            refunded,
          };
        },
      }),

      listStreams: tool({
        description: "List all salary streams with their progress, amounts, and status",
        parameters: z.object({
          _unused: z.string().optional().describe("Not used"),
        }),
        execute: async () => {
          const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/stream`);
          if (!res.ok) return { error: "Failed to fetch streams" };
          return await res.json();
        },
      }),

      listRequests: tool({
        description: "List all payment requests with their status and amounts",
        parameters: z.object({
          _unused: z.string().optional().describe("Not used"),
        }),
        execute: async () => {
          const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/request`);
          if (!res.ok) return { error: "Failed to fetch requests" };
          return await res.json();
        },
      }),

      listRecurring: tool({
        description: "List all recurring scheduled transfers",
        parameters: z.object({
          _unused: z.string().optional().describe("Not used"),
        }),
        execute: async () => {
          const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/recurring`);
          if (!res.ok) return { error: "Failed to fetch recurring transfers" };
          return await res.json();
        },
      }),

      listSubscriptions: tool({
        description: "List all subscription plans",
        parameters: z.object({
          _unused: z.string().optional().describe("Not used"),
        }),
        execute: async () => {
          const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/subscription`);
          if (!res.ok) return { error: "Failed to fetch subscriptions" };
          return await res.json();
        },
      }),

      getYieldEstimate: tool({
        description: "Estimate how much yield a given amount would earn over a period at current APY",
        parameters: z.object({
          amount: z.number().describe("Amount of tokens"),
          days: z.number().describe("Number of days to estimate yield for"),
        }),
        execute: async (params: { amount?: number; days?: number } | null) => {
          const amount = params?.amount || 100;
          const days = params?.days || 30;
          const apy = await getLiveApy();
          const yieldEarned = amount * apy * (days / 365);
          return {
            amount,
            days,
            apy: `${(apy * 100).toFixed(2)}%`,
            estimatedYield: yieldEarned.toFixed(6),
            total: (amount + yieldEarned).toFixed(6),
          };
        },
      }),
    },
    maxSteps: 5,
  });

  return result.toUIMessageStreamResponse();
}
