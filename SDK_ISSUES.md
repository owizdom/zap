# StarkZap SDK — Issues Found Building Zapp

> Real issues hit in production while building [Zapp](https://zapp-five.vercel.app) with `starkzap@1.0.0`.

---

## 1. Silent failure on invalid network string

**Severity:** Critical

When the `network` parameter contains trailing whitespace (e.g. `"sepolia\n"` from env vars), the SDK fails with a misleading error instead of catching the actual problem.

```ts
const sdk = new StarkZap({ network: "sepolia\n" });
// Error: "StarkSDK requires either 'network' or 'rpcUrl' to be specified"
```

**Root cause:** The SDK does `networks[config.network]` — `networks["sepolia\n"]` returns `undefined` since only `"sepolia"` and `"mainnet"` are valid keys. The error then says network wasn't provided, which is wrong — it was provided, just with a trailing newline.

**Impact:** Every SDK operation failed — staking, transfers, wallet creation. The error gave no hint about whitespace. I lost hours debugging before running `vercel env pull` and spotting raw `\n` bytes in the env value.

**Suggested fix:**
```ts
const network = config.network?.trim();
if (network && !networks[network]) {
  throw new Error(`Invalid network "${network}". Valid options: ${Object.keys(networks).join(", ")}`);
}
```

**My workaround:** `.trim()` on every env var before passing to the SDK.

---

## 2. Staking setup requires too much boilerplate

**Severity:** Medium

Creating a `Staking` instance requires manually wiring together 4 separate pieces that the SDK already knows:

```ts
// Current: developer has to do all of this
const sdk = new StarkZap({ network: "sepolia" });
const provider = sdk.getProvider();
const chainId = ChainId.SEPOLIA;
const stakingConfig = getStakingPreset(chainId);
const staking = await Staking.fromStaker(validator, token, provider, stakingConfig);
```

The SDK already knows the network, so it knows the provider, chain ID, and staking preset. This could be:

```ts
const staking = await sdk.getStaking(validator, token);
```

**Impact:** Every project using staking writes the same 4-line setup. I see the same pattern in StarkFlame, StarkSplit, and StarkFolio submissions — everyone wraps it in a helper because the SDK doesn't provide one.

---

## 3. PrivySigner config is complex and underdocumented

**Severity:** Medium

`PrivySigner` requires a `PrivySignerConfig` with 7 fields. The type definition doesn't explain the relationships between them or provide a usage example:

```ts
interface PrivySignerConfig {
  walletId: string;
  publicKey: string;
  serverUrl?: string;
  rawSign?: (hash: string) => Promise<string>;
  headers?: Record<string, string>;
  buildBody?: (hash: string) => Record<string, unknown>;
  requestTimeoutMs?: number;
}
```

**Questions I had to answer by reading SDK source:**
- Do I provide `serverUrl` OR `rawSign`? (Answer: one or the other)
- What format does `rawSign` expect? Hex string? BigInt? (Answer: hex)
- Is `publicKey` the Stark key or the Privy wallet's key?
- What does the signing endpoint request/response look like?

**Suggested fix:** A cookbook example showing the full Next.js Privy flow — frontend `usePrivy()` login, backend signing endpoint, SDK `onboard()` call — would save every Privy integrator significant time.

---

## Summary

| # | Issue | Severity | My workaround |
|---|-------|----------|----------------|
| 1 | Invalid network string causes misleading error | Critical | `.trim()` all env vars |
| 2 | Staking setup boilerplate (4 lines that could be 1) | Medium | Helper function in `lib/escrow.ts` |
| 3 | PrivySigner config underdocumented | Medium | Read SDK source + trial and error |

---

*All issues from real production usage. Zapp uses 28 SDK modules — I've exercised the SDK deeply enough to find these.*

