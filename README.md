# Zapp

Email-based crypto transfers on Starknet. Send STRK/ETH/USDC to any email address — recipient claims with a link, no wallet required.

Built for the [StarkZap Developer Challenge](https://github.com/keep-starknet-strange/awesome-starkzap).

**Live:** https://zapp-five.vercel.app

---

## What it does

- Sender enters a recipient email and amount, connects a wallet (Cartridge or ArgentX/Braavos), and confirms the transfer on-chain
- Backend records the zap and emails the recipient a claim link
- Recipient opens the link, enters a Starknet address, and receives the funds
- Unclaimed zaps accrue yield (~5% APY). The longer they wait, the more they receive
- After 30 days, the sender can reclaim via the ZapVault contract

### Features

- **Send** — one-time transfers (STRK, ETH, USDC)
- **Request** — generate a payment link to send to a payer
- **Split** — split a bill across multiple emails
- **Stream** — salary streaming (per-second drip, recipient claims anytime)
- **Subscriptions** — recurring pull payments (merchant-initiated)
- **Contacts** — auto-populated from transfer history
- **Dashboard** — full history, status, yield tracking

---

## Contract

ZapVault is deployed on Starknet Sepolia. It holds ERC20 tokens in escrow, keyed by a unique `zap_id`. The owner (escrow wallet) releases funds to a verified recipient address. If unclaimed after 30 days, the sender can refund permissionlessly.

| | |
|---|---|
| Contract | [`0x0728c9fdb708ddaf950f52032f1b136c74240cf40eebf4c51a6e7f6d0f0e7bbb`](https://sepolia.voyager.online/contract/0x0728c9fdb708ddaf950f52032f1b136c74240cf40eebf4c51a6e7f6d0f0e7bbb) |
| Class hash | `0x6b19bfd3128159f6eaa91684b67a4a92f5d174fa98befdb5c2ea1141d1d85d3` |
| Network | Starknet Sepolia |

**Interface:**
```
deposit(zap_id, token, amount, recipient_hash)
release(zap_id, recipient)   // owner only
refund(zap_id)               // sender only, after 30 days
get_zap(zap_id) -> ZapRecord
```

---

## StarkZap SDK usage

| Module | Where used |
|--------|------------|
| `StarkZap` | SDK init with AVNU Paymaster (gasless) |
| `OnboardStrategy.Signer` | Backend escrow wallet |
| `StarkSigner` | Server-side signing for release/refund |
| `wallet.transfer()` | Deposit to escrow; release to recipient |
| `sepoliaTokens` | Token address presets |
| `Amount.parse()` | Safe amount parsing |
| `fromAddress()` | Address normalization |
| `Staking` | Yield accumulation on held funds |

---

## Stack

- **Next.js 15** (App Router, server API routes)
- **StarkZap SDK v1** — wallet, ERC20, staking, gasless
- **Cartridge Controller** — social login wallet (gasless via AVNU Paymaster)
- **ArgentX / Braavos** — browser extension wallet support via `window.starknet`
- **Cairo / Scarb** — ZapVault escrow contract
- **Resend** — transactional email
- **SQLite (better-sqlite3)** — zap record storage

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

| Variable | Description |
|----------|-------------|
| `ESCROW_PRIVATE_KEY` | Starknet private key for the server escrow wallet |
| `ESCROW_ADDRESS` | Escrow wallet address |
| `NEXT_PUBLIC_ESCROW_ADDRESS` | Same, exposed to browser |
| `NEXT_PUBLIC_VAULT_ADDRESS` | ZapVault contract address |
| `NEXT_PUBLIC_NETWORK` | `sepolia` or `mainnet` |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM` | Sender address (e.g. `Zapp <noreply@yourdomain.com>`) |
| `NEXT_PUBLIC_APP_URL` | Deployment URL (used in claim email links) |

---

Built on Starknet. Powered by StarkZap SDK.
