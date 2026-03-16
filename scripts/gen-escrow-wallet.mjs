/**
 * Generate a new Starknet escrow wallet for Zap.
 * Uses OpenZeppelin account preset (same as starkzap's default Signer strategy).
 * Run: node scripts/gen-escrow-wallet.mjs
 */
import { ec, stark, hash, CallData } from "starknet";
import { writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// OZ AccountUpgradeable v3.0.0-alpha — matches starkzap's OpenZeppelinPreset
const OZ_CLASS_HASH = "0x002de258cce5b9e160bf83956b09f982059582469f7e6fad07b438128317d029";

// Generate a random private key
const privateKey = stark.randomAddress();
const publicKey = ec.starkCurve.getStarkKey(privateKey);

// Compute counterfactual address (same formula as starkzap's AccountProvider)
const constructorCalldata = CallData.compile({ publicKey });
const address = hash.calculateContractAddressFromHash(
  publicKey,        // salt = public key (OZ convention)
  OZ_CLASS_HASH,
  constructorCalldata,
  0                 // deployer address = 0 for counterfactual
);

console.log("\n⚡ Zap — Escrow Wallet Generated\n");
console.log("Private key : " + privateKey);
console.log("Public key  : " + publicKey);
console.log("Address     : " + address);
console.log("\n📋 Copy this into .env.local:\n");

const envContent = `# Zap — Escrow Wallet (auto-generated)
ESCROW_PRIVATE_KEY=${privateKey}
ESCROW_ADDRESS=${address}
NEXT_PUBLIC_ESCROW_ADDRESS=${address}

# Resend — get free API key at https://resend.com
RESEND_API_KEY=re_YOUR_KEY_HERE
RESEND_FROM=onboarding@resend.dev

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Network
NEXT_PUBLIC_NETWORK=sepolia
`;

console.log(envContent);

// Write .env.local if it doesn't exist yet
const envPath = join(ROOT, ".env.local");
if (!existsSync(envPath)) {
  writeFileSync(envPath, envContent, "utf8");
  console.log("✅ Written to .env.local — add your RESEND_API_KEY then run: npm run dev\n");
} else {
  console.log("⚠️  .env.local already exists — copy the values above into it manually.\n");
}

console.log("💧 Fund the escrow wallet with test STRK:");
console.log("   https://starknet-faucet.vercel.app\n");
console.log("   Paste this address: " + address);
console.log("\nThen run: npm run dev\n");
