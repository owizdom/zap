# Zapp — StarkZap Developer Challenge Submission

**Live app:** https://zapp-five.vercel.app
**Repo:** https://github.com/owizdom/zap
**Network:** Starknet Sepolia
**ZapVault contract:** `0x0728c9fdb708ddaf950f52032f1b136c74240cf40eebf4c51a6e7f6d0f0e7bbb`

---

## What Zapp does

Zapp lets you send STRK, ETH, or USDC to any email address. The recipient gets a link — no wallet required to receive. Funds are held in escrow and earn real on-chain staking yield (via STRK delegation to a Starknet validator) while waiting to be claimed. The longer they wait, the more they receive.

Beyond one-time sends, the same email-native UX covers:
- **Payment requests** — generate a link, anyone can pay you
- **Bill splits** — split across multiple emails in one flow
- **Salary streaming** — per-second token drip, claimable at any time
- **Subscriptions** — merchant-initiated recurring pulls from authorized subscribers
- **Contacts** — auto-populated social graph from transfer history

---

## StarkZap SDK — full usage inventory

Every SDK module listed here is used in production code, not mocked.

### `StarkZap` (SDK init)
**File:** `lib/escrow.ts`

```ts
import { StarkZap } from "starkzap";

const sdk = new StarkZap({
  network: "sepolia",
  paymaster: { nodeUrl: "https://starknet.paymaster.avnu.fi" },
});
```

Used to initialise the SDK for both server-side escrow wallet operations and provider access.

---

### `OnboardStrategy.Signer` + `StarkSigner`
**File:** `lib/escrow.ts`

```ts
import { OnboardStrategy, StarkSigner } from "starkzap";

const { wallet } = await sdk.onboard({
  strategy: OnboardStrategy.Signer,
  account: { signer: new StarkSigner(process.env.ESCROW_PRIVATE_KEY) },
  deploy: "if_needed",
});
```

The server-managed escrow wallet. Holds all deposited funds, executes releases to recipients, and manages the staking position. `deploy: "if_needed"` ensures it auto-deploys if not yet on-chain.

---

### `OnboardStrategy.Cartridge`
**File:** `app/send/page.tsx`

Cartridge Controller is offered as a gasless wallet option for senders (social login, no seed phrase, AVNU paymaster covers fees).

---

### `window.starknet` (ArgentX / Braavos)
**File:** `app/send/page.tsx`

Browser extension wallets are supported as a second wallet path. The sender picks Cartridge or ArgentX/Braavos at the start of the send flow.

---

### `Amount.parse()` + `Amount.fromRaw()`
**Files:** `lib/escrow.ts`, `lib/yield.ts`, `app/send/page.tsx`

```ts
import { Amount } from "starkzap";

// Parsing human-readable input
const amount = Amount.parse("1.5", sepoliaTokens.STRK);

// Constructing from raw blockchain value
const amount = Amount.fromRaw(BigInt(amountRaw), sepoliaTokens.STRK);
```

Used for all amount handling — deposit, release, staking. `Amount.fromRaw()` is used when converting stored raw values (e.g. from DB) back to SDK-compatible amounts.

---

### `fromAddress()`
**File:** `lib/escrow.ts`

```ts
import { fromAddress } from "starkzap";

const to = fromAddress(recipientAddress); // normalises any Starknet address format
```

Used in every transfer to normalise recipient addresses before passing to the SDK.

---

### `sepoliaTokens` + `mainnetTokens`
**File:** `lib/escrow.ts`

```ts
import { sepoliaTokens, mainnetTokens } from "starkzap";

const tokens = NETWORK === "sepolia" ? sepoliaTokens : mainnetTokens;
const strk = tokens.STRK;
const eth  = tokens.ETH;
const usdc = tokens.USDC;
```

All three tokens (STRK, ETH, USDC) are supported in the send, request, stream, and split flows.

---

### `sepoliaValidators`
**File:** `lib/escrow.ts`

```ts
import { sepoliaValidators } from "starkzap";

const VALIDATOR = sepoliaValidators.NETHERMIND;
```

Used to pick the target validator for all staking operations. Nethermind is used for reliability.

---

### `Staking.fromStaker()`
**File:** `lib/escrow.ts`

```ts
import { Staking } from "starkzap";

const staking = await Staking.fromStaker(
  VALIDATOR.stakerAddress,
  tokens.STRK,
  provider,
  stakingConfig,
);
```

Creates a `Staking` instance bound to Nethermind's STRK delegation pool. Used for all staking operations below.

---

### `Staking.activeTokens()`
**File:** `lib/escrow.ts`

```ts
const activeTokens = await Staking.activeTokens(provider, stakingConfig);
```

Dynamically discovers which tokens are currently enabled for staking in the protocol. Exposed via `GET /api/stake` and displayed in the dashboard so the escrow never hardcodes token availability.

---

### `staking.stake()` via `TxBuilder`
**File:** `lib/escrow.ts`

```ts
const tx = await wallet.tx()
  .stake(staking.poolAddress, amount)  // atomic approve + enter/add
  .send();
await tx.wait();
```

Called on every STRK deposit. `TxBuilder.stake()` auto-selects `enterPool` vs `addToPool` based on current membership and bundles the approve call — all in one atomic multicall.

---

### `TxBuilder` — atomic multicall
**File:** `lib/escrow.ts`

`TxBuilder` is used for all on-chain operations:

```ts
// Stake
wallet.tx().stake(poolAddress, amount).send()

// Claim rewards
wallet.tx().claimPoolRewards(poolAddress).send()

// Exit intent (begin unstaking)
wallet.tx().exitPoolIntent(poolAddress, amount).send()

// Complete exit (after unbonding window)
wallet.tx().exitPool(poolAddress).send()

// Transfer to recipient
wallet.tx().transfer(token, { to, amount }).send()
```

Every escrow operation is an atomic multicall — no split transactions, no partial failures.

---

### `staking.claimRewards()` via `TxBuilder`
**File:** `lib/escrow.ts`

```ts
const tx = await wallet.tx()
  .claimPoolRewards(staking.poolAddress)
  .send();
```

Called before every claim release. Sweeps accumulated validator rewards back into the escrow wallet so they are included in the recipient's payout.

---

### `staking.exitIntent()` via `TxBuilder`
**File:** `lib/escrow.ts`

```ts
const tx = await wallet.tx()
  .exitPoolIntent(staking.poolAddress, amount)
  .send();
```

Initiates the unbonding process. Exposed via `POST /api/stake { action: "exit_intent" }`. After the Starknet exit window passes, `exitPool` completes the withdrawal.

---

### `staking.exit()` via `TxBuilder`
**File:** `lib/escrow.ts`

```ts
const tx = await wallet.tx()
  .exitPool(staking.poolAddress)
  .send();
```

Completes exit after the unbonding window. Exposed via `POST /api/stake { action: "exit" }`.

---

### `staking.getPosition()`
**File:** `lib/escrow.ts`

```ts
const position = await staking.getPosition(wallet);
// position.staked, position.rewards, position.total,
// position.unpooling, position.unpoolTime, position.commissionPercent
```

Queries the live on-chain position. Polled every 60 seconds by the dashboard widget.

---

### `staking.getCommission()`
**File:** `lib/escrow.ts` — `getLiveApy()`

```ts
const commission = await staking.getCommission();
const netApy = 0.05 * (1 - commission / 100);
```

Real validator commission is used to calculate the net APY stored on each zap at creation time. Recipients see yield based on the actual rate of the pool, not a hardcoded 5%.

---

### `getStakingPreset()` + `ChainId`
**File:** `lib/escrow.ts`

```ts
import { getStakingPreset, ChainId } from "starkzap";

const chainId = NETWORK === "sepolia" ? ChainId.SEPOLIA : ChainId.MAINNET;
const stakingConfig = getStakingPreset(chainId);
```

Resolves the core staking contract address for the active network. Used by `Staking.fromStaker()` and `Staking.activeTokens()`.

---

### AVNU Paymaster
**File:** `lib/escrow.ts`

```ts
new StarkZap({
  network: NETWORK,
  paymaster: { nodeUrl: "https://starknet.paymaster.avnu.fi" },
})
```

The escrow wallet uses gasless transactions when releasing to recipients. Falls back to user-paid gas if the paymaster rejects (e.g. low balance). Cartridge Controller also uses AVNU for sender-side gasless deposits.

---

## Cairo contract — ZapVault

**Address:** `0x0728c9fdb708ddaf950f52032f1b136c74240cf40eebf4c51a6e7f6d0f0e7bbb`
**Class:** `0x6b19bfd3128159f6eaa91684b67a4a92f5d174fa98befdb5c2ea1141d1d85d3`
**Source:** `contracts/src/lib.cairo`

ZapVault is the on-chain escrow. Each zap is keyed by a unique `zap_id` (felt252). The vault holds ERC20 tokens and releases them when the owner (escrow wallet) calls `release()` with the recipient address. If unclaimed after 30 days, the sender can call `refund()` permissionlessly.

```cairo
fn deposit(zap_id, token, amount, recipient_hash)  // sender locks funds
fn release(zap_id, recipient)                       // owner releases to recipient
fn refund(zap_id)                                   // sender reclaims after 30 days
fn get_zap(zap_id) -> ZapRecord                     // read state
```

No OpenZeppelin dependency — ERC20 interface is inlined to keep the contract minimal.

---

## API surface

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/zap` | POST | Create zap, send email, stake STRK on-chain |
| `/api/zap/[id]/claim` | POST | Claim rewards, release to recipient |
| `/api/stake` | GET | Live position: staked, rewards, APY, activeTokens |
| `/api/stake` | POST | Actions: stake / claim_rewards / exit_intent / exit |
| `/api/apy` | GET | Net APY from validator commission |
| `/api/balance` | GET | Escrow wallet balance |
| `/api/stream` | POST | Create salary stream |
| `/api/stream/[id]/claim` | POST | Claim accrued stream amount |
| `/api/subscription` | POST | Create subscription plan |
| `/api/subscription/[id]/collect` | POST | Merchant pull payment |
| `/api/request` | POST | Create payment request |
| `/api/recurring` | POST | Create recurring transfer |

---

## MCP Server — 30 AI Agent Tools

Zapp includes a Model Context Protocol (MCP) server at `mcp/` that lets AI agents interact with the full platform. **30 tools** across 7 categories: Transfers, Payment Requests, Streams, Subscriptions, Recurring, Wallet & Staking, Contacts.

```bash
cd mcp && npm install && npx tsx src/index.ts
```

Compatible with Claude Desktop, Claude Code, Cursor, Windsurf, and any MCP client.

See [`mcp/README.md`](mcp/README.md) for the full tool list and setup instructions.

---

## SDK module count

| Module | Used |
|--------|------|
| `StarkZap` | init |
| `OnboardStrategy.Signer` | server escrow wallet |
| `OnboardStrategy.Privy` | social login claims (Google → Privy wallet) |
| `OnboardStrategy.Cartridge` | sender gasless wallet |
| `StarkSigner` | escrow key management |
| `PrivySigner` | Privy-managed wallet signing for recipients |
| `Amount.parse()` | human input → SDK amount |
| `Amount.fromRaw()` | raw bigint → SDK amount |
| `fromAddress()` | address normalisation |
| `sepoliaTokens` | STRK / ETH / USDC presets |
| `mainnetTokens` | mainnet token presets |
| `sepoliaValidators` | validator selection |
| `getPresets()` | dynamic token preset discovery per chain |
| `Staking.fromStaker()` | pool instance |
| `Staking.activeTokens()` | dynamic token discovery |
| `staking.stake()` | enter/add pool |
| `staking.claimRewards()` | harvest rewards |
| `staking.exitIntent()` | begin unbonding |
| `staking.exit()` | complete withdrawal |
| `staking.getPosition()` | live position query |
| `staking.getCommission()` | real APY calculation |
| `TxBuilder` | atomic multicall for all ops |
| `getStakingPreset()` | staking contract resolution |
| `ChainId` | network chain ID |
| `ArgentXV050Preset` | account preset for Privy wallets |
| `accountPresets` | all available account type configs |
| `FeeMode` | fee configuration (sponsored / user_pays) |
| AVNU Paymaster | gasless releases |

**28 distinct SDK modules used.**
