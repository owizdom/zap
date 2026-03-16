# ⚡ Zap — Send Bitcoin to anyone's email. It earns yield while they wait.

> Built for the [Starkzap Developer Challenge](https://github.com/keep-starknet-strange/awesome-starkzap)

**Live app:** https://zapp-five.vercel.app

**ZapVault contract (Sepolia):** [`0x0728c9fdb708ddaf950f52032f1b136c74240cf40eebf4c51a6e7f6d0f0e7bbb`](https://sepolia.voyager.online/contract/0x0728c9fdb708ddaf950f52032f1b136c74240cf40eebf4c51a6e7f6d0f0e7bbb)

---

## What is Zap?

Zap turns sending Bitcoin into sending a message.

1. **You send a Zap** — enter recipient email + STRK amount, connect Cartridge wallet, confirm.
2. **It earns yield** — funds sit in a Starknet staking pool at ~5% APY while unclaimed.
3. **They claim it** — recipient gets an email with a link, signs in with Google/Apple (no wallet, no seed phrase), and receives the original amount **plus yield earned**.

The longer they wait to open it, the more they get.

---

## Starkzap SDK Usage

| Module | Usage |
|--------|-------|
| `StarkZap` | SDK init with AVNU Paymaster (gasless) |
| `connectCartridge` | Sender wallet — social login, no seed phrase |
| `OnboardStrategy.Signer` | Backend escrow wallet (server-managed key) |
| `wallet.transfer()` | Sender→escrow deposit; escrow→recipient release |
| `wallet.stake()` | STRK staking for yield accumulation |
| `sepoliaTokens.STRK` | Sepolia token preset |
| `Amount.parse()` | Type-safe amount parsing |
| `fromAddress()` | Address conversion helper |

---

## Architecture

```
Sender (browser)
  └─ Cartridge wallet via StarkZap SDK
       └─ transfer STRK → Escrow wallet
            └─ Backend records zap (SQLite)
                 └─ Resend sends claim email
                      └─ Recipient opens link
                           └─ Enters Starknet address
                                └─ Backend releases STRK + yield → recipient
```

### Cairo Smart Contract (ZapVault)
Deployed on **Starknet Sepolia** — `0x0728c9fdb708ddaf950f52032f1b136c74240cf40eebf4c51a6e7f6d0f0e7bbb`

- `deposit()` — sender locks funds keyed by zap_id + keccak(recipient_email)
- `release()` — owner releases to authenticated recipient address
- `refund()` — sender reclaims after 30-day expiry (permissionless)
- Full event log for auditability

Class hash: `0x6b19bfd3128159f6eaa91684b67a4a92f5d174fa98befdb5c2ea1141d1d85d3`

---

## Running Locally

```bash
git clone https://github.com/YOUR_HANDLE/zap
cd zap
npm install
cp .env.example .env.local
# Fill in ESCROW_PRIVATE_KEY, RESEND_API_KEY, NEXT_PUBLIC_APP_URL
npm run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ESCROW_PRIVATE_KEY` | Starknet private key for the escrow wallet |
| `ESCROW_ADDRESS` | Public address of the escrow wallet |
| `NEXT_PUBLIC_ESCROW_ADDRESS` | Same address, exposed to browser for transfer target |
| `RESEND_API_KEY` | Resend API key (free tier: 3000 emails/month) |
| `RESEND_FROM` | Sender email address |
| `NEXT_PUBLIC_APP_URL` | Deployment URL (for claim links) |
| `NEXT_PUBLIC_NETWORK` | `sepolia` or `mainnet` |
| `NEXT_PUBLIC_VAULT_ADDRESS` | ZapVault contract address on Starknet Sepolia |

---

## Tech Stack

- **Next.js 15** — App Router, server API routes
- **[Starkzap SDK](https://starkzap.io)** — Wallet, ERC20, staking, gasless
- **Cartridge Controller** — Social login wallet for senders
- **AVNU Paymaster** — Gasless transactions
- **Cairo** — ZapVault trustless escrow contract
- **Resend** — Email delivery
- **better-sqlite3** — Zap record storage

---

_Built on Starknet · Powered by Starkzap SDK_
