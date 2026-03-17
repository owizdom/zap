// @ts-nocheck
import { streamText, tool, stepCountIs } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";
import { getAllZaps } from "@/lib/db";
import { calcYield, calcProtocolFee, formatToken } from "@/lib/yield";
import {
  getEscrowBalance,
  getLiveApy,
  getStakingPosition,
  getActiveStakingTokens,
  getValidatorInfo,
} from "@/lib/escrow";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

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
        description: "Get the escrow wallet balance for a token. Call with token STRK, ETH, or USDC.",
        parameters: z.object({
          token: z.string().describe("Token symbol: STRK, ETH, or USDC"),
        }),
        execute: async (params) => {
          const token = params?.token || "STRK";
          const balance = await getEscrowBalance(token);
          return { balance, token };
        },
      }),

      getApy: tool({
        description: "Get the current live staking APY percentage and validator name.",
        parameters: z.object({
          query: z.string().describe("What to look up, e.g. 'current apy'"),
        }),
        execute: async () => {
          const apy = await getLiveApy();
          const validator = getValidatorInfo();
          return {
            apyPercent: `${(apy * 100).toFixed(2)}%`,
            validator: validator.name,
          };
        },
      }),

      getStakingPosition: tool({
        description: "Get the current staking position: staked amount, rewards, APY, and active tokens.",
        parameters: z.object({
          query: z.string().describe("What to look up, e.g. 'staking position'"),
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
            apyPercent: `${(apy * 100).toFixed(2)}%`,
            activeTokens: activeTokens.map((t) => t.symbol),
          };
        },
      }),

      listTransfers: tool({
        description: "List recent transfers (zaps) with status, amounts, yield, and recipient info.",
        parameters: z.object({
          limit: z.number().describe("Max number of transfers to return, e.g. 5 or 10"),
        }),
        execute: async (params) => {
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
        description: "Get summary statistics: total sent, total yield accrued, counts by status.",
        parameters: z.object({
          query: z.string().describe("What stats to get, e.g. 'transfer summary'"),
        }),
        execute: async () => {
          const zaps = await getAllZaps();
          let totalSent = 0;
          let totalYield = 0;
          const counts = { pending: 0, funded: 0, claimed: 0, refunded: 0 };
          for (const z of zaps) {
            totalSent += parseFloat(formatToken(BigInt(z.amount_raw), z.token));
            if (z.status !== "claimed") {
              const yieldGross = calcYield(z.amount_raw, z.created_at, z.yield_apy ?? 0.05);
              const fee = calcProtocolFee(yieldGross);
              totalYield += parseFloat(formatToken(yieldGross - fee, z.token));
            }
            counts[z.status as keyof typeof counts]++;
          }
          return { totalTransfers: zaps.length, totalSent: totalSent.toFixed(4), totalYieldAccrued: totalYield.toFixed(6), ...counts };
        },
      }),

      getYieldEstimate: tool({
        description: "Estimate yield for a given token amount over a number of days at current APY.",
        parameters: z.object({
          amount: z.number().describe("Amount of tokens, e.g. 100"),
          days: z.number().describe("Number of days, e.g. 30"),
        }),
        execute: async (params) => {
          const amount = params?.amount || 100;
          const days = params?.days || 30;
          const apy = await getLiveApy();
          const yieldEarned = amount * apy * (days / 365);
          return {
            amount,
            days,
            apyPercent: `${(apy * 100).toFixed(2)}%`,
            estimatedYield: yieldEarned.toFixed(6),
            total: (amount + yieldEarned).toFixed(6),
          };
        },
      }),
    },
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
