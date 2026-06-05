# Live smoke test: keepa-mcp

Run this the moment you have a Keepa API key. It exercises all 6 tools against
the real Keepa API. These are manual checks only. The automated test suite stays
fully mocked and must never make live calls.

## Prerequisites

```bash
cd keepa-mcp
npm install
npm run build
export KEEPA_API_KEY="your-real-key-here"
```

Keepa uses a per-minute token quota. If you see a token or rate-limit error,
wait a minute between calls. The lowest paid tier is enough for this test.

## Option A: MCP Inspector CLI (recommended, no extra files)

List tools (no key needed, proves the server starts):

```bash
npx @modelcontextprotocol/inspector --cli node dist/index.js --method tools/list
```

Then call each tool. Substitute a current ASIN if the example one is stale.
B08N5WRWNW is an Amazon Echo Dot, usually a safe, data-rich ASIN to test with.

```bash
# 1. get_product
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call --tool-name get_product --tool-arg asin=B08N5WRWNW

# 2. get_price_history
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call --tool-name get_price_history --tool-arg asin=B08N5WRWNW

# 3. get_sales_rank_history
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call --tool-name get_sales_rank_history --tool-arg asin=B08N5WRWNW

# 4. search_products
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call --tool-name search_products --tool-arg keyword="jigsaw puzzle"

# 5. get_best_sellers (category id; 165793011 is Toys & Games on .com)
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call --tool-name get_best_sellers --tool-arg category=165793011

# 6. get_deals
npx @modelcontextprotocol/inspector --cli node dist/index.js \
  --method tools/call --tool-name get_deals
```

## What "pass" looks like

- tools/list returns 6 tools: get_product, get_price_history,
  get_sales_rank_history, search_products, get_best_sellers, get_deals.
- get_product returns a real title, brand, and current price for the ASIN.
- The two history tools return a dated series, not an empty result.
- search_products and get_best_sellers return ASIN lists.
- No "missing KEEPA_API_KEY", auth, or unexpected-shape errors.

## If something is wrong

The Keepa client has NOT been verified against the live API before this test.
If a tool returns a parsing error or an unexpected shape, the likely cause is a
field-name or CSV-index mismatch in src/services/keepa-client.ts. Capture the raw
error text, fix the mapping, add or update a mocked fixture in tests/ to lock the
fix in, then rebuild and rerun. Keep all automated tests mocked.
