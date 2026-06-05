# keepa-mcp

**Amazon price and sales-rank history for your AI assistant, via the Keepa API.**

![CI](https://github.com/purahmanian/keepa-mcp/actions/workflows/ci.yml/badge.svg)
![npm](https://img.shields.io/npm/v/keepa-mcp)

---

> **Unofficial package.** keepa-mcp is not affiliated with, endorsed by, or
> supported by Keepa GmbH. "Keepa" and "Amazon" are trademarks of their
> respective owners. This is an independent open-source client for the
> publicly documented Keepa API.

---

## What it does

| Tool | Description | Example prompt |
|------|-------------|----------------|
| `get_product` | Title, brand, category, current prices, buy box, review count and rating | "What is the current Amazon price and rating for ASIN B08N5WRWNW?" |
| `get_price_history` | Decoded price time series for Amazon, new, used, and buy-box prices | "Show me the price history for B08N5WRWNW over the past year" |
| `get_sales_rank_history` | Sales rank over time plus a demand trend summary | "Is demand trending up or down for B07PXGQC1Q?" |
| `search_products` | Keyword product search, returns matching ASINs | "Find ASINs for 'wireless earbuds' on Amazon" |
| `get_best_sellers` | Top ASINs in a Keepa category | "What are the best sellers in Electronics?" |
| `get_deals` | Current price-drop deals filtered by drop % and rating | "Show deals with at least 30% off and 4.5 stars" |

---

## Quick start

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "keepa": {
      "command": "npx",
      "args": ["-y", "keepa-mcp"],
      "env": {
        "KEEPA_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add keepa -e KEEPA_API_KEY=your_key -- npx -y keepa-mcp
```

### OpenAI Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.keepa]
command = "npx"
args = ["-y", "keepa-mcp"]

[mcp_servers.keepa.env]
KEEPA_API_KEY = "YOUR_API_KEY_HERE"
```

---

## Getting a Keepa API key

<!-- AFFILIATE -->
Sign up at [https://keepa.com/#!api](https://keepa.com/#!api) to get your API key.
<!-- /AFFILIATE -->

The free tier provides **100 tokens per minute.** Each product data request
costs tokens proportional to the data retrieved (history length, number of
offers, etc.). Typical product lookups cost 1-5 tokens; best-seller lists and
deals cost more. See the [Keepa API docs](https://keepa.com/#!discuss/t/api)
for the full token cost table.

**Token economics at a glance:**

- `get_product` (no history): 1 token
- `get_product` (with history): 1-10 tokens depending on data depth
- `get_best_sellers`: 50-100 tokens per request
- `get_deals`: 5-25 tokens per page
- Free tier refills at 100 tokens/minute

If you hit the quota, the tool returns a clear error message and you can
retry after the bucket refills.

---

## Example conversations

**1. Product research**

> "Look up B08N5WRWNW, then show me the last 6 months of price history and
> tell me whether demand has been growing."

The assistant calls `get_product`, then `get_price_history` with range="6m",
then `get_sales_rank_history` with range="6m", and synthesises a verdict.

**2. Category opportunity scan**

> "Pull the top 20 best sellers in Electronics (category 172282), then
> get current details and sales rank trends for the first three."

The assistant calls `get_best_sellers`, then `get_product` and
`get_sales_rank_history` for the first three ASINs, and summarises
the demand signals.

**3. Deal hunting**

> "Find highly-rated Amazon deals with at least 25% off, then show
> me the price history for the top result to confirm it is a genuine dip."

The assistant calls `get_deals` with min_price_drop_pct=25, min_rating=45,
picks the top ASIN, then calls `get_price_history` with range="6m" to
validate the claimed price drop against historical data.

---

## Development

```bash
# Install dependencies
npm install

# Run tests (no live HTTP; all upstream calls are mocked)
npm test

# Build TypeScript to dist/
npm run build

# Start the server (requires KEEPA_API_KEY in environment)
KEEPA_API_KEY=your_key node dist/index.js
```

### Project structure

```
src/
  index.ts                 # Server entry point, tool registration
  constants.ts             # API base URL, Keepa time offset, limits
  types.ts                 # TypeScript interfaces
  services/
    keepa-client.ts        # Fetch wrapper, time utilities, history decoder
  tools/
    get-product.ts
    get-price-history.ts
    get-sales-rank-history.ts
    search-products.ts
    get-best-sellers.ts
    get-deals.ts
tests/
  keepa-client.test.ts     # Unit tests for time conversion and history decoding
  tools.test.ts            # Integration tests with mocked fetch + fixture JSON
  fixtures/                # Realistic Keepa response shapes
```

---

## Built by

Built by **Puya Ventures LLC**. I build custom MCP servers and AI integrations
for product-research, e-commerce, and SaaS teams. Get in touch:
**purahmanian@gmail.com** | Portfolio: [puyarahmanian.com](https://puyarahmanian.com)

Part of the **Product-Research MCP Suite**:
[keepa-mcp](https://github.com/purahmanian/keepa-mcp) ·
[google-trends-mcp](https://github.com/purahmanian/google-trends-mcp) ·
[junglescout-mcp](https://github.com/purahmanian/junglescout-mcp)

---

## Privacy

This server runs entirely on your machine. It collects no telemetry and stores
no data. The only network calls it makes are to the Keepa API
(api.keepa.com), sending your API key and the ASINs, keywords, or category ids
you ask about. Your API key is read from the KEEPA_API_KEY environment variable
and never written to disk or sent anywhere except Keepa. See Keepa's privacy
policy: https://keepa.com/#!privacy

## License

MIT. See [LICENSE](./LICENSE).
