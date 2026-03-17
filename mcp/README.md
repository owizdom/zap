# Zapp MCP Server

Model Context Protocol (MCP) server for **Zapp** — the email-native crypto transfer app on Starknet. This server exposes **30 tools** that let AI agents send crypto, manage streams, subscriptions, recurring transfers, check balances, estimate yield, and more.

## Why?

MCP lets AI assistants (Claude, Cursor, Windsurf, etc.) interact with Zapp programmatically. Instead of clicking through a UI, you can say:

- *"Send 50 STRK to alice@example.com"*
- *"How much yield would 1000 STRK earn over 30 days?"*
- *"Set up a monthly salary stream of 500 STRK to bob@example.com"*
- *"Show me all my pending transfers"*

The AI agent calls the appropriate Zapp tool behind the scenes.

## Quick Start

```bash
cd mcp
npm install
npx tsx src/index.ts
```

## Configuration

| Variable | Description | Default |
|---|---|---|
| `ZAPP_API_URL` | Base URL of your Zapp instance | `https://zapp-five.vercel.app` |
| `ZAPP_API_KEY` | Optional API key for authenticated endpoints | (none) |

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

## Adding to MCP Clients

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "zapp": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/zap/mcp/src/index.ts"],
      "env": {
        "ZAPP_API_URL": "https://zapp-five.vercel.app",
        "ZAPP_API_KEY": ""
      }
    }
  }
}
```

### Claude Code (CLI)

Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "zapp": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/zap/mcp/src/index.ts"],
      "env": {
        "ZAPP_API_URL": "https://zapp-five.vercel.app"
      }
    }
  }
}
```

### Cursor

Go to **Settings > MCP Servers > Add Server**:

- **Name:** `zapp`
- **Command:** `npx tsx /absolute/path/to/zap/mcp/src/index.ts`
- **Environment:** `ZAPP_API_URL=https://zapp-five.vercel.app`

### Windsurf / Other MCP Clients

Any client that supports MCP over stdio can run:

```bash
ZAPP_API_URL=https://zapp-five.vercel.app npx tsx /path/to/zap/mcp/src/index.ts
```

## Available Tools (30)

### Transfers

| Tool | Description |
|---|---|
| `send_zap` | Send STRK/ETH/USDC to any email. Recipient gets a claim link; funds earn yield while unclaimed. |
| `check_zap` | Look up a Zap by ID. Returns status, yield accrued, APY, sender, recipient. |
| `claim_zap` | Claim a pending Zap. Sends original amount + yield to a Starknet address. |
| `list_transfers` | List all Zap transfers with computed yield, status, and metadata. |
| `resend_claim_email` | Resend the claim notification email for a pending Zap. |
| `export_transfers` | Export full transfer history as CSV. |

### Payment Requests

| Tool | Description |
|---|---|
| `create_payment_request` | Create a payment request link. Optionally email it to someone. |
| `get_payment_request` | Look up a payment request by ID. |
| `list_payment_requests` | List all payment requests. |
| `pay_request` | Fulfill a payment request. Creates a Zap from payer to requester. |

### Streams (Salary / Vesting)

| Tool | Description |
|---|---|
| `create_stream` | Create a continuous payment stream over a set duration. |
| `get_stream` | Get stream details: claimable amount, progress, completion status. |
| `list_streams` | List all payment streams. |
| `claim_stream` | Claim accrued tokens from a stream to a Starknet address. |

### Subscriptions (Recurring Billing)

| Tool | Description |
|---|---|
| `create_subscription` | Create a subscription plan with billing interval. |
| `get_subscription` | Get subscription plan details. |
| `list_subscriptions` | List all subscription plans. |
| `authorize_subscription` | Authorize a subscription as a subscriber. |
| `collect_subscription` | Collect a due subscription payment to a merchant address. |
| `cancel_subscription` | Cancel an active subscription. |

### Recurring Transfers

| Tool | Description |
|---|---|
| `create_recurring` | Set up automatic recurring transfers on a schedule. |
| `list_recurring` | List all recurring transfer schedules. |
| `cancel_recurring` | Cancel a recurring transfer schedule. |
| `trigger_recurring` | Process all due recurring transfers now. |

### Wallet & Staking

| Tool | Description |
|---|---|
| `get_balance` | Get escrow wallet balance for a specific token. |
| `get_staking_position` | Get full staking position: staked, rewards, APY, validator, commission. |
| `get_apy` | Get current live staking APY and validator info. |
| `get_yield_estimate` | Calculate estimated yield for an amount over a duration. |

### Contacts

| Tool | Description |
|---|---|
| `get_contacts` | List contacts from transfer history. Optionally get history with a specific contact. |
| `set_contact_nickname` | Set a friendly nickname for a contact. |

## Architecture

```
AI Agent  <-->  MCP (stdio)  <-->  Zapp MCP Server  <-->  Zapp API (HTTP)
                                                           |
                                                           v
                                                     Starknet (L2)
```

The MCP server is a thin HTTP client layer. It translates MCP tool calls into REST API requests against any deployed Zapp instance. No blockchain keys or database access needed — all operations go through the Zapp API.

## Supported Tokens

- **STRK** — Starknet native token (18 decimals, stakeable)
- **ETH** — Ether on Starknet (18 decimals)
- **USDC** — USD Coin on Starknet (6 decimals)

## Development

```bash
# Watch mode (restarts on file changes)
npm run dev

# Type check
npx tsc --noEmit

# Build to dist/
npm run build
```

## License

MIT
