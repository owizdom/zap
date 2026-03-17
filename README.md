# Zapp

**Send crypto to any email. Earn yield while they claim.**

Zapp is an email-native crypto transfer platform on Starknet. Send STRK, ETH, or USDC to any email address — the recipient claims with a link, no wallet or crypto knowledge required. Funds earn real staking yield (~5% APY via Starknet validators) while waiting to be claimed.

Built with the [StarkZap SDK](https://github.com/keep-starknet-strange/starkzap) — **28 SDK modules used**.

**Live:** [zapp-five.vercel.app](https://zapp-five.vercel.app)
**Demo:** [Watch on YouTube](https://youtu.be/cVmv_5Y4CyY)
**Contract:** [`0x0728c...5d0e`](https://sepolia.voyager.online/contract/0x0728c9fdb708ddaf950f52032f1b136c74240cf40eebf4c51a6e7f6d0f0e7bbb) (Starknet Sepolia)

---

## Architecture

```
Sender                  Zapp Platform                      Starknet
  |                         |                                  |
  |   1. Send 10 STRK      |                                  |
  |   to alice@email.com   |                                  |
  |----------------------->|                                  |
  |                         |  2. On-chain deposit             |
  |                         |  (Cartridge gasless              |
  |                         |   or ArgentX/Braavos)            |
  |                         |--------------------------------->|
  |                         |                                  |  ZapVault.deposit()
  |                         |  3. Stake deposited STRK         |
  |                         |  into Nethermind validator pool   |
  |                         |--------------------------------->|
  |                         |                                  |  TxBuilder.stake()
  |                         |  4. Email claim link             |
  |                         |  to alice@email.com              |
  |                         |                                  |
                                                               |  Yield accrues...
Recipient                   |                                  |
  |   5. Click claim link   |                                  |
  |   Sign in with Google   |                                  |
  |   (Privy - no wallet)   |                                  |
  |----------------------->|                                  |
  |                         |  6. Release principal + yield    |
  |                         |--------------------------------->|
  |                         |                                  |  TxBuilder.transfer()
  |   7. Receives           |                                  |
  |   10 STRK + 0.014 yield |                                  |
  |<------------------------|                                  |

AI Agent (MCP)              |
  |   "Send 50 STRK to      |
  |    bob@email.com"        |
  |------------------------>|  (30 MCP tools available)
```

---

## Features

| Feature | Description | Page |
|---------|-------------|------|
| **Send** | One-time transfers (STRK, ETH, USDC) to any email | `/send` |
| **Request** | Generate a payment link, share it with a payer | `/request` |
| **Split** | Split a bill across multiple emails in one flow | `/send` (toggle) |
| **Stream** | Per-second salary streaming, claimable anytime | `/stream` |
| **Subscriptions** | Merchant-initiated recurring pull payments | `/subscribe/[id]` |
| **Recurring** | Automatic transfers on a schedule (7/14/30/90 days) | `/send` (toggle) |
| **Contacts** | Auto-populated from transfer history, nicknames, search | `/contacts` |
| **Dashboard** | Full history, status tracking, live yield, staking position | `/dashboard` |
| **AI Quick-fill** | Natural language input: "Send 10 STRK to alice@gmail.com for dinner" | `/send` |
| **AI Chat** | On-chain data assistant — balances, staking, transfers, yield estimates | Every page |

### Claim flow (zero crypto knowledge)

1. Recipient gets an email with a claim link
2. Opens the link — sees transfer amount + live yield ticker
3. **Option A:** Sign in with Google (via Privy) — wallet created behind the scenes, gasless claim
4. **Option B:** Paste a Starknet address
5. Receives principal + accrued yield (minus 10% protocol fee on yield only)

---

## ZapVault — Cairo Smart Contract

Custom escrow contract deployed on Starknet. Not a wrapper around existing protocols — purpose-built for Zapp.

```cairo
deposit(zap_id, token, amount, recipient_hash)  // sender locks funds
release(zap_id, recipient)                       // owner releases to recipient
refund(zap_id)                                   // sender reclaims after 30 days
get_zap(zap_id) -> ZapRecord                     // read state
```

| | |
|---|---|
| Contract | [`0x0728c9fdb708ddaf950f52032f1b136c74240cf40eebf4c51a6e7f6d0f0e7bbb`](https://sepolia.voyager.online/contract/0x0728c9fdb708ddaf950f52032f1b136c74240cf40eebf4c51a6e7f6d0f0e7bbb) |
| Class hash | `0x6b19bfd3128159f6eaa91684b67a4a92f5d174fa98befdb5c2ea1141d1d85d3` |
| Source | `contracts/ZapVault.cairo` |
| Tests | `contracts/tests/test_zapvault.cairo` (snforge) |

Events emitted: `ZapDeposited`, `ZapReleased`, `ZapRefunded` — all indexed by `zap_id` for on-chain auditability.

---

## MCP Server — 30 AI Agent Tools

Zapp includes a Model Context Protocol (MCP) server that lets AI agents interact with the platform programmatically. Any MCP-compatible client (Claude Desktop, Claude Code, Cursor, Windsurf) can send money, manage streams, check balances, and more.

```bash
cd mcp && npm install && npx tsx src/index.ts
```

| Category | Tools | Count |
|----------|-------|-------|
| Transfers | `send_zap`, `check_zap`, `claim_zap`, `list_transfers`, `resend_claim_email`, `export_transfers` | 6 |
| Payment Requests | `create_payment_request`, `get_payment_request`, `list_payment_requests`, `pay_request` | 4 |
| Streams | `create_stream`, `get_stream`, `list_streams`, `claim_stream` | 4 |
| Subscriptions | `create_subscription`, `get_subscription`, `list_subscriptions`, `authorize_subscription`, `collect_subscription`, `cancel_subscription` | 6 |
| Recurring | `create_recurring`, `list_recurring`, `cancel_recurring`, `trigger_recurring` | 4 |
| Wallet & Staking | `get_balance`, `get_staking_position`, `get_apy`, `get_yield_estimate` | 4 |
| Contacts | `get_contacts`, `set_contact_nickname` | 2 |

See [`mcp/README.md`](mcp/README.md) for setup instructions and Claude Desktop / Cursor configuration.

---

## StarkZap SDK — 28 Modules

Every module listed here is used in production code, verified in source.

| # | Module | Usage | File |
|---|--------|-------|------|
| 1 | `StarkZap` | SDK init with network + paymaster config | `lib/escrow.ts` |
| 2 | `OnboardStrategy.Signer` | Server-side escrow wallet (backend signs) | `lib/escrow.ts` |
| 3 | `OnboardStrategy.Privy` | Social login claims (Google → Privy wallet) | `lib/escrow.ts` |
| 4 | `OnboardStrategy.Cartridge` | Gasless sender wallet (social login) | `app/send/page.tsx` |
| 5 | `StarkSigner` | Private key signing for escrow operations | `lib/escrow.ts` |
| 6 | `PrivySigner` | Privy-managed wallet signing for recipients | `lib/escrow.ts` |
| 7 | `Amount.parse()` | Human-readable input → SDK amount | `lib/escrow.ts` |
| 8 | `Amount.fromRaw()` | Raw bigint → SDK amount (DB values) | `lib/escrow.ts` |
| 9 | `fromAddress()` | Address normalization for all transfers | `lib/escrow.ts` |
| 10 | `sepoliaTokens` | STRK / ETH / USDC token presets | `lib/escrow.ts` |
| 11 | `mainnetTokens` | Mainnet token presets | `lib/escrow.ts` |
| 12 | `sepoliaValidators` | Validator selection (Nethermind) | `lib/escrow.ts` |
| 13 | `getPresets()` | Dynamic token preset discovery per chain | `lib/escrow.ts`, `app/send/page.tsx` |
| 14 | `Staking.fromStaker()` | Delegation pool instance | `lib/escrow.ts` |
| 15 | `Staking.activeTokens()` | Dynamic staking token discovery | `lib/escrow.ts` |
| 16 | `staking.stake()` | Enter/add to delegation pool (TxBuilder) | `lib/escrow.ts` |
| 17 | `staking.claimRewards()` | Harvest accumulated rewards (TxBuilder) | `lib/escrow.ts` |
| 18 | `staking.exitIntent()` | Begin unbonding from pool (TxBuilder) | `lib/escrow.ts` |
| 19 | `staking.exit()` | Complete exit after unbonding window | `lib/escrow.ts` |
| 20 | `staking.getPosition()` | Live on-chain position query | `lib/escrow.ts` |
| 21 | `staking.getCommission()` | Real validator commission for net APY | `lib/escrow.ts` |
| 22 | `TxBuilder` | Atomic multicall for all on-chain ops | `lib/escrow.ts` |
| 23 | `getStakingPreset()` | Staking contract resolution per chain | `lib/escrow.ts` |
| 24 | `ChainId` | Network chain ID enum | `lib/escrow.ts` |
| 25 | `ArgentXV050Preset` | Account preset for Privy wallets | `lib/escrow.ts` |
| 26 | `accountPresets` | All available account type configs | `lib/escrow.ts` |
| 27 | `FeeMode` | Fee configuration (`sponsored` / `user_pays`) | `lib/escrow.ts`, `app/send/page.tsx` |
| 28 | AVNU Paymaster | Gasless transaction sponsorship | `lib/escrow.ts` |

---

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/zap` | POST | Create zap: record transfer, send claim email, trigger staking |
| `/api/zap/[id]` | GET | Get zap details with computed yield |
| `/api/zap/[id]/claim` | POST | Claim: release principal + yield to recipient address |
| `/api/zap/[id]/resend` | POST | Resend claim notification email |
| `/api/zaps` | GET | List all zaps for authenticated user |
| `/api/request` | POST/GET | Create / list payment requests |
| `/api/request/[id]` | GET | Get payment request details |
| `/api/request/[id]/pay` | POST | Fulfill a payment request |
| `/api/stream` | POST/GET | Create / list salary streams |
| `/api/stream/[id]` | GET/PATCH | Get / update stream |
| `/api/stream/[id]/claim` | POST | Claim accrued stream tokens |
| `/api/recurring` | POST/GET | Create / list recurring transfers |
| `/api/recurring/[id]` | DELETE | Cancel recurring transfer |
| `/api/recurring/trigger` | POST | Process all due recurring transfers |
| `/api/subscription` | POST/GET | Create / list subscription plans |
| `/api/subscription/[id]` | GET | Get subscription details |
| `/api/subscription/[id]/authorize` | POST | Subscriber authorizes plan |
| `/api/subscription/[id]/collect` | POST | Merchant collects due payment |
| `/api/contacts` | GET/PATCH | Get contacts / set nickname |
| `/api/balance` | GET | Escrow wallet balance |
| `/api/apy` | GET | Live staking APY from validator |
| `/api/stake` | GET/POST | Staking position / actions (stake, claim, exit) |
| `/api/export` | GET | Export all transfers as CSV |

---

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS |
| Backend | Next.js API Routes (serverless) |
| Blockchain | StarkZap SDK v1, Starknet.js, AVNU Paymaster |
| Smart Contract | Cairo (Scarb), tested with snforge |
| Wallets | Cartridge Controller (gasless), ArgentX/Braavos, Privy (social login) |
| Database | Turso (cloud SQLite via libSQL) |
| Email | Nodemailer (Gmail SMTP) |
| Auth | NextAuth.js (Google OAuth) |
| AI Integration | MCP server (30 tools), AI Chat (Groq + live on-chain data) |

---

## Running locally

```bash
git clone https://github.com/owizdom/zap
cd zap
npm install
cp .env.example .env.local   # fill in vars below
npm run dev
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ESCROW_PRIVATE_KEY` | Yes | Starknet private key for the server escrow wallet |
| `ESCROW_ADDRESS` | Yes | Escrow wallet contract address |
| `NEXT_PUBLIC_ESCROW_ADDRESS` | Yes | Same, exposed to browser for deposit targeting |
| `NEXT_PUBLIC_VAULT_ADDRESS` | Yes | ZapVault contract address |
| `NEXT_PUBLIC_NETWORK` | Yes | `sepolia` or `mainnet` |
| `TURSO_DATABASE_URL` | Yes | Turso database URL (or `file:./zap.db` for local) |
| `TURSO_AUTH_TOKEN` | Prod | Turso auth token (not needed for local file DB) |
| `GMAIL_USER` | Yes | Gmail address for sending emails |
| `GMAIL_APP_PASSWORD` | Yes | Gmail app password (requires 2FA) |
| `EMAIL_FROM` | No | Sender display (defaults to `Zapp <GMAIL_USER>`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Deployment URL (used in claim email links) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `NEXTAUTH_SECRET` | Yes | NextAuth session encryption secret |
| `NEXT_PUBLIC_PRIVY_APP_ID` | No | Privy app ID (enables social login claims) |
| `PRIVY_APP_SECRET` | No | Privy server-side secret |

### MCP Server

```bash
cd mcp
npm install
ZAPP_API_URL=http://localhost:3000 npx tsx src/index.ts
```

---

Built on Starknet. Powered by StarkZap SDK.
