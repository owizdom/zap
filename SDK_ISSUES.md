# StarkZap SDK — Issues & Feedback from Building Zapp

> Discovered while building Zapp (email-native crypto transfers) using `starkzap@1.0.0`.
> These are genuine issues encountered in production, not synthetic edge cases.

---

## 1. Silent failure on invalid network string

**Severity:** Critical
**File:** SDK `StarkZap` constructor

When the `network` parameter contains whitespace (e.g. `"sepolia\n"` from env vars), the SDK silently fails instead of throwing a clear error.

```ts
// This throws a generic error:
const sdk = new StarkZap({ network: "sepolia\n" });
// Error: "StarkSDK requires either 'network' or 'rpcUrl' to be specified"
```

**Root cause:** The SDK does `networks[config.network]` which returns `undefined` for `"sepolia\n"` since only `"sepolia"` and `"mainnet"` exist as keys. Then it checks `if (!networkPreset && !config.rpcUrl)` and throws a misleading error suggesting neither was provided.

**Impact:** All staking operations, transfers, and wallet creation silently failed. The error message doesn't mention the actual problem (invalid network value), so debugging took hours. We only found it by running `vercel env pull` and inspecting raw bytes.

**Suggested fix:**
```ts
// Before lookup, trim and validate
const network = config.network?.trim();
if (network && !networks[network]) {
  throw new Error(`Invalid network "${network}". Expected "sepolia" or "mainnet".`);
}
```

**Workaround:** `.trim()` every env var before passing to the SDK.

---

## 2. `Amount.fromRaw()` / `Amount.toBase()` naming inconsistency

**Severity:** Low (DX)

The factory method is `Amount.fromRaw()` but the inverse is `Amount.toBase()`, not `Amount.toRaw()`.

```ts
// Create from raw
const amount = Amount.fromRaw(1500000000000000000n, tokens.STRK);

// Get raw back — intuition says toRaw(), but it's toBase()
amount.toRaw();  // ❌ TypeError: toRaw is not a function
amount.toBase(); // ✅ 1500000000000000000n
```

**Impact:** We hit a TypeScript build error on `amount.toRaw()` during fee estimation. Minor, but the asymmetric naming trips you up if you're writing code from memory.

**Suggested fix:** Add `toRaw()` as an alias for `toBase()`, or document the naming convention prominently.

---

## 3. `Staking.fromStaker()` requires manual provider + config wiring

**Severity:** Medium (DX)

Creating a `Staking` instance requires manually extracting the provider and staking config from separate sources:

```ts
// Current: 4 lines of boilerplate
const sdk = new StarkZap({ network: "sepolia" });
const provider = sdk.getProvider();
const chainId = ChainId.SEPOLIA;
const stakingConfig = getStakingPreset(chainId);
const staking = await Staking.fromStaker(validator, token, provider, stakingConfig);
```

Since the SDK already knows the network (and therefore the provider, chain ID, and staking preset), this could be a one-liner:

```ts
// Suggested
const staking = await sdk.getStaking(validator, token);
```

**Impact:** Every project using staking has to write the same boilerplate. We wrapped it in a helper, but it should be in the SDK.

---

## 4. `getPresets()` vs `sepoliaTokens` / `mainnetTokens` — unclear when to use which

**Severity:** Low (docs)

The SDK exports three ways to get token presets:
1. `sepoliaTokens` / `mainnetTokens` — static objects with `.STRK`, `.ETH`, `.USDC`
2. `getPresets(chainId)` — dynamic, returns `Record<string, Token>`
3. `Staking.activeTokens()` — dynamic, returns `Token[]` of stakeable tokens

It's not documented when you'd use `getPresets()` over the static exports. We ended up using both:
- `sepoliaTokens` for known tokens (STRK, ETH, USDC)
- `getPresets()` for displaying all available tokens dynamically

**Suggested fix:** Document the relationship between these three. A note like "use `sepoliaTokens` for the core 3, `getPresets()` for all tokens on a chain, `activeTokens()` for stakeable tokens" would save time.

---

## 5. `PrivySigner` config shape is complex and underdocumented

**Severity:** Medium

`PrivySigner` requires a `PrivySignerConfig` with fields like `walletId`, `publicKey`, `serverUrl`, `rawSign`, `headers`, `buildBody`, `requestTimeoutMs`. The relationship between these fields and Privy's server-side API isn't obvious from the type definitions alone.

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

**Questions we had:**
- Do we provide `serverUrl` OR `rawSign`? Or both?
- What format does `rawSign` expect the hash in? Hex? BigInt string?
- Is `publicKey` the Stark public key or the Privy wallet's public key?
- What headers does the Privy signing endpoint expect?

**Impact:** Took trial and error to get the Privy integration working. Had to read the SDK source to understand the flow.

**Suggested fix:** Add a cookbook example for Privy integration showing the full Next.js flow (frontend login → backend signing → SDK usage).

---

## 6. No way to check if a wallet is already deployed

**Severity:** Low

`sdk.onboard()` with `deploy: "if_needed"` works, but there's no way to check deployment status without triggering the full onboard flow.

```ts
// We wanted to do:
const isDeployed = await sdk.isDeployed(address); // ❌ doesn't exist

// Instead, we call onboard every time and rely on "if_needed"
const { wallet } = await sdk.onboard({ ..., deploy: "if_needed" });
```

**Impact:** On every API request, we call `getEscrowWallet()` which runs the full onboard flow. It's fast when the wallet is already deployed, but it would be cleaner to have a lightweight check.

---

## 7. `wallet.estimateFee()` type signature unclear

**Severity:** Low

The `estimateFee` method on the wallet interface isn't well-typed for common operations. We had to construct raw call data manually:

```ts
const fee = await wallet.estimateFee([{
  contractAddress: token.address as string,
  entrypoint: "transfer",
  calldata: [recipientAddress, amount256.low.toString(), amount256.high.toString()],
}]);
```

It would be cleaner to estimate fees using the same TxBuilder pattern:

```ts
// Suggested
const fee = await wallet.tx()
  .transfer(token, { to, amount })
  .estimateFee(); // instead of .send()
```

---

## 8. Paymaster errors are not typed

**Severity:** Low

When the AVNU paymaster rejects a transaction (low balance, unsupported token, rate limit), the error is a generic string. We had to pattern-match on error message content:

```ts
function isPaymasterError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return msg.includes("paymaster") || msg.includes("max_fee") ||
         msg.includes("fee budget") || msg.includes("insufficient_max_fee");
}
```

**Suggested fix:** Throw a typed `PaymasterError` class so consumers can catch it cleanly:

```ts
try {
  await wallet.tx().transfer(token, transfer).send();
} catch (err) {
  if (err instanceof PaymasterError) {
    // retry without paymaster
  }
}
```

---

## Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Silent failure on invalid network string | Critical | Workaround (`.trim()`) |
| 2 | `fromRaw()` / `toBase()` naming asymmetry | Low | Workaround |
| 3 | Staking requires manual provider + config wiring | Medium | Wrapped in helper |
| 4 | Token preset methods underdocumented | Low | Used both approaches |
| 5 | PrivySigner config complex + underdocumented | Medium | Figured out from source |
| 6 | No lightweight deployment check | Low | Using `deploy: "if_needed"` |
| 7 | Fee estimation requires raw calldata | Low | Constructed manually |
| 8 | Paymaster errors not typed | Low | String pattern matching |

---

*All issues discovered during real production usage. Zapp is live at [zapp-five.vercel.app](https://zapp-five.vercel.app) with workarounds for all of the above.*
