# StarkZap Developer Challenge — Competitor Analysis

> Judged across 5 metrics. Max score: 50 points per project.
> Based on verified code review of all PRs at github.com/keep-starknet-strange/awesome-starkzap/pulls.
> Last updated: post-improvements (MCP server, Privy, SDK primitives, README overhaul).

**Prizes**
- $1,500: Best overall build
- $1,000: Runner up
- $500: Most creative integration

**Metrics**
1. **Works** — Live app, real on-chain transactions, no mock fallbacks
2. **Polish** — UI/UX quality, docs, repo professionalism
3. **Use Case** — Novelty, real-world fit, originality
4. **SDK** — Depth of StarkZap SDK usage (verified in code, not just claimed)
5. **Deploy** — Sepolia = 6–7, Mainnet = 8–10, not deployed = 1–3

---

## Key finding from full PR review

**Only 5-6 projects out of ~40 submissions have genuine, verifiable starkzap SDK usage.** The rest use Cartridge Controller directly, raw starknet.js, mock transactions (`Math.random()` tx hashes), or have no verifiable repo.

**Original analysis inflated Veil Protocol's SDK score.** Veil's starkzap integration is limited to the portfolio/staking tab. Core privacy features (shield/unveil, ZK proofs, escrow) use raw `starknet` library, NOT starkzap. Revised SDK: 9 → 6.

**Missed competitor: StarkFlame (PR #58).** Gamified STRK staking with on-chain streak logic, custom Cairo contract, and deep SDK integration (9/10). Serious "Most Creative" contender.

---

## Final Rankings

| Rank | Project | PR | Works | Polish | Use Case | SDK | Deploy | **Total** |
|------|---------|-----|-------|--------|----------|-----|--------|-----------|
| 1 | StarkFi | #54 | 8 | 9 | 9 | 10 | 8 | **44** |
| 2 | **Zapp** | — | 8 | 8 | 8 | 10 | 7 | **41** |
| 3 | Veil Protocol | #13 | 8 | 8 | 9 | 6 | 9 | **40** |
| 4 | StarkFlame | #58 | 7 | 7 | 8 | 9 | 6 | **37** |
| 5 | StarkSplit | #14 | 7 | 6 | 7 | 8 | 6 | **34** |
| 6 | StarkDeep | #25 | 7 | 6 | 4 | 8 | 8 | **33** |
| 7 | StarkYield | #12 | 7 | 7 | 4 | 6 | 6 | **30** |
| 8 | StarkFolio | #18 | 6 | 6 | 7 | 5 | 6 | **30** |
| 9 | ZapLend | #59 | 5 | 5 | 7 | 6 | 6 | **29** |
| 10 | Winky-Starkzap | #5 | 3 | 7 | 9 | 6 | 3 | **28** |

> Everything else scores below 25. Most have zero verifiable starkzap usage.

---

## Top 5 — Detailed Breakdown

### 1. StarkFi — 44/50

**Repo:** github.com/ahmetenesdur/starkfi
**Live:** starkfi.app · **npm:** `npx starkfi@latest` · **Docs:** docs.starkfi.app

Not a web app — a published npm package. CLI with 30+ commands covering Fibrous DEX swaps, multi-token staking, Vesu V2 lending/borrowing, and atomic multicall batching. MCP server with 27 tools. Contributed ESM fix merged upstream into the StarkZap SDK (#75).

**SDK depth (verified):** `StarkZap`, `PrivySigner`, `ArgentXV050Preset`, `FeeMode`, `Amount`, `fromAddress`, `getPresets()`, `wallet.stake()`, `wallet.claimPoolRewards()`, `wallet.exitPoolIntent()`, `wallet.exitPool()`, `wallet.getPoolPosition()`, `wallet.getPoolCommission()`, `sdk.getStakerPools()`, `wallet.tx().claimPoolRewards().stake().send()` (TxBuilder compound multicall). Multi-token staking: STRK, WBTC, tBTC, SolvBTC, LBTC. 5-token gas abstraction via FeeMode.

**Why they win:** Developer infrastructure. CLI + npm + MCP + docs site. TxBuilder multicall compounding is unique — no other project does atomic compound-then-restake. Upstream SDK contribution.

**Weak points:** Not consumer-facing. Demo is a Twitter thread. AWS auth server adds operational complexity.

---

### 2. Zapp — 41/50 (→ 43 with mainnet)

**Live:** zapp-five.vercel.app · **Starknet Sepolia**
**Contract:** `0x0728c9fdb708ddaf950f52032f1b136c74240cf40eebf4c51a6e7f6d0f0e7bbb`

Email-native transfers with real on-chain yield. 9 features: send, request, split, stream, subscriptions, recurring, contacts, dashboard, AI quick-fill. Funds held in escrow (ZapVault Cairo contract), staked into Nethermind's delegation pool, earning 4.95% net APY. Recipients claim via social login (Privy) or wallet address — no crypto knowledge needed.

**MCP server:** 30 tools across 7 categories. Beats StarkFi's 27.

**SDK depth (verified, 28 modules):** `StarkZap`, `OnboardStrategy.Signer`, `OnboardStrategy.Privy`, `OnboardStrategy.Cartridge`, `StarkSigner`, `PrivySigner`, `Amount.parse()`, `Amount.fromRaw()`, `fromAddress()`, `sepoliaTokens`, `mainnetTokens`, `sepoliaValidators`, `getPresets()`, `Staking.fromStaker()`, `Staking.activeTokens()`, `staking.stake()`, `staking.claimRewards()`, `staking.exitIntent()`, `staking.exit()`, `staking.getPosition()`, `staking.getCommission()`, `TxBuilder`, `getStakingPreset()`, `ChainId`, `ArgentXV050Preset`, `accountPresets`, `FeeMode`, AVNU Paymaster.

**Why 2nd:** Most complete consumer app in the field. Only submission with email-native UX + real yield + social login claims + MCP server + custom Cairo contract + full test suite. SDK depth (28) exceeds StarkFi (22+ primitives used, though StarkFi also wraps Vesu/Fibrous). The gap to 1st is positioning (consumer app vs developer tools), not depth.

**Gap to 1st:** 3 points (41 vs 44). Mainnet deploy closes to 1 point (43 vs 44).

---

### 3. Veil Protocol — 40/50

**Repo:** github.com/shariqazeem/veil-protocol
**Live:** theveilprotocol.vercel.app · **Starknet Mainnet**

ZK privacy pools with Noir proofs, Garaga on-chain verifier, Vitalik-style Association Sets. AI privacy agent, Telegram bot, x402 micropayments. Live on mainnet with real money.

**SDK depth (verified, 14 modules):** `Staking`, `Amount`, `Erc20`, `mainnetTokens` (9 token presets), `mainnetValidators` (5 validators), `Staking.fromStaker()`, `getPosition()`, `activeTokens()`, `Erc20.balanceOf()`, `Erc20.populateTransfer()`, `populateExitIntent`, `populateClaimRewards`, `populateExit`.

**Critical note:** Starkzap SDK is only used in the portfolio/staking tab. Core privacy features (shield/unveil, ZK proofs, escrow) use raw `starknet` library and `@starknet-react/core`, NOT starkzap. The previous SDK score of 9 was inflated.

**Why 3rd:** Technically the most ambitious project overall. Mainnet deployment. But starkzap integration is a bolt-on for the portfolio section, not the core product. Judges who check SDK usage in code will see the gap.

---

### 4. StarkFlame — 37/50

**Repo:** github.com/sandragcarrillo/starkflame
**Live:** starkflame.vercel.app · **Starknet Sepolia**

Gamified STRK staking with on-chain streak logic. Custom Cairo contract (`flame_streak.cairo`). 6 visual flame evolution stages. Friend-to-friend sending. Email invites via Resend.

**SDK depth (verified, 9/10):** `StarkSDK`, `PrivySigner`, `Amount`, `sepoliaTokens`, `fromAddress`, `wallet.stake()`, `wallet.getPoolPosition()`, `wallet.claimPoolRewards()`, `wallet.exitPool()`, `wallet.exitPoolIntent()`, `wallet.transfer()`, `wallet.execute()` (custom contract calls).

**Why 4th:** One of the best `starkzap` integration files in the competition. Genuinely novel use case. But narrower scope than top 3.

**Most Creative contender:** Strong candidate for $500 prize.

---

### 5. StarkSplit — 34/50

**Repo:** github.com/azeemshaik025/stark-split
**Live:** stark-split.vercel.app · **Starknet Sepolia**

Bill splitting with on-chain settlements. 416-line starkzap integration file. Cartridge Controller with session policies. Gasless fallback handling. Custom token transfers.

**SDK depth (verified):** `StarkZap`, `fromAddress`, `Amount`, `sepoliaTokens`, `mainnetTokens`, `OnboardStrategy`, `WalletInterface`, `sdk.connectWallet()`, `sdk.getStakerPools()`, `wallet.stake()`, `wallet.claimPoolRewards()`, `wallet.exitPoolIntent()`, `wallet.exitPool()`, `wallet.getPoolPosition()`, `wallet.transfer()`, FeeMode fallback.

---

## SDK Usage Comparison (updated)

| Module | StarkFi | **Zapp** | Veil | StarkFlame | StarkSplit |
|--------|---------|----------|------|-----------|------------|
| `StarkZap` init | ✓ | ✓ | ✓ | ✓ | ✓ |
| `OnboardStrategy.Signer` | — | ✓ | — | — | — |
| `OnboardStrategy.Privy` | ✓ | ✓ | — | ✓ | — |
| `OnboardStrategy.Cartridge` | — | ✓ | — | — | ✓ |
| `PrivySigner` | ✓ | ✓ | — | ✓ | — |
| `StarkSigner` | — | ✓ | — | — | — |
| `ArgentXV050Preset` | ✓ | ✓ | — | — | — |
| `accountPresets` | — | ✓ | — | — | — |
| `FeeMode` | ✓ | ✓ | — | ✓ | ✓ |
| `Amount.parse()` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `Amount.fromRaw()` | — | ✓ | — | — | — |
| `fromAddress()` | ✓ | ✓ | — | ✓ | ✓ |
| `sepoliaTokens` | ✓ | ✓ | — | ✓ | ✓ |
| `mainnetTokens` | ✓ | ✓ | ✓ | — | ✓ |
| `sepoliaValidators` | — | ✓ | — | — | — |
| `mainnetValidators` | — | — | ✓ | — | — |
| `getPresets()` | ✓ | ✓ | — | — | — |
| `Staking.fromStaker()` | — | ✓ | ✓ | — | — |
| `Staking.activeTokens()` | — | ✓ | ✓ | — | — |
| `staking.stake()` | ✓ | ✓ | — | ✓ | ✓ |
| `staking.claimRewards()` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `staking.exitIntent()` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `staking.exit()` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `staking.getPosition()` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `staking.getCommission()` | — | ✓ | — | — | — |
| `getStakingPreset()` | ✓ | ✓ | — | — | — |
| `ChainId` | — | ✓ | — | — | — |
| `TxBuilder` multicall | ✓ | ✓ | — | — | — |
| `Erc20.balanceOf()` | — | — | ✓ | — | — |
| `Erc20.populateTransfer()` | — | — | ✓ | — | — |
| `wallet.execute()` custom | — | — | — | ✓ | — |
| `sdk.getStakerPools()` | ✓ | — | — | — | ✓ |
| Paymaster config | ✓ | ✓ | — | ✓ | ✓ |
| **Distinct modules** | **~22** | **28** | **14** | **~15** | **~14** |

---

## MCP Server Comparison

| | StarkFi | **Zapp** |
|---|---------|----------|
| MCP tools | 27 | **30** |
| Categories | 5 (wallet, trade, staking, lending, auth) | **7** (transfers, requests, streams, subs, recurring, staking, contacts) |
| Approach | Direct SDK integration | HTTP API wrapper |
| Consumer features | — | Transfers, streams, subscriptions, contacts |

---

## What Zapp has that nobody else does

| Unique capability | Present in any other submission? |
|-------------------|--------------------------------|
| Email-native transfers (send to email, claim via link) | No |
| Yield accrual on held funds | No |
| Per-second salary streaming | No |
| Subscription pull payments | No |
| Social login claims (Privy → gasless) | No |
| Custom Cairo escrow contract + tests | StarkFlame has custom contract too |
| MCP server with 30 tools | StarkFi has 27 |
| `OnboardStrategy.Signer` (server escrow wallet) | No |
| `staking.getCommission()` for live APY | No |
| Protocol fee on yield (business model) | No |

---

## Prize prediction

| Prize | Most likely | Zapp chance |
|-------|-------------|-------------|
| $1,500 Best overall | StarkFi | 25% — competitive if judges value consumer completeness + SDK depth over CLI tooling |
| $1,000 Runner up | Zapp or Veil | **55%** — Zapp has deeper SDK (28 vs 14), more MCP tools (30 vs 0), more features (9 vs bolt-on). Veil has mainnet + ZK. |
| $500 Most creative | StarkFlame | 25% — email-native + yield is creative, but StarkFlame's gamification is more "creative" |

---

## What changes with mainnet deploy

| Metric | Sepolia | Mainnet |
|--------|---------|---------|
| Deploy score | 7 | 9 |
| Total | 41 | **43** |
| Gap to StarkFi | −3 | **−1** |
| vs Veil | +1 | **+3** |
| Prize position | Runner up (competitive) | Runner up (likely) or Best overall (possible) |

---

## Honest assessment vs previous analysis

| What changed | Old score | New score | Why |
|--------------|-----------|-----------|-----|
| Veil SDK | 9 | 6 | Starkzap is portfolio-tab-only, not core product |
| Veil total | 43 | 40 | SDK downgrade |
| StarkFlame | Not in analysis | 37 | Missed competitor (PR #58) |
| Zapp SDK | 10 | 10 | Was 22 modules, now 28 with improvements |
| Zapp total | 42 | 41 | More honest Works score (8 not 9 — bugs were recently fixed) |

*Analysis based on verified code review of all public PRs. Zapp scores reflect post-improvement state.*
