#!/usr/bin/env node
/**
 * keepa-mcp: MCP server for the Keepa Amazon price and sales-rank history API.
 *
 * Provides 6 tools: get_product, get_price_history, get_sales_rank_history,
 * search_products, get_best_sellers, get_deals.
 *
 * Requires KEEPA_API_KEY environment variable.
 * If missing, the server still starts but tools return an instructional message.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { GetProductInputSchema, runGetProduct } from "./tools/get-product.js";
import {
  GetPriceHistoryInputSchema,
  runGetPriceHistory,
} from "./tools/get-price-history.js";
import {
  GetSalesRankHistoryInputSchema,
  runGetSalesRankHistory,
} from "./tools/get-sales-rank-history.js";
import {
  SearchProductsInputSchema,
  runSearchProducts,
} from "./tools/search-products.js";
import {
  GetBestSellersInputSchema,
  runGetBestSellers,
} from "./tools/get-best-sellers.js";
import { GetDealsInputSchema, runGetDeals } from "./tools/get-deals.js";

// --------------------------------------------------------------------------
// API key resolution
// --------------------------------------------------------------------------

const KEEPA_API_KEY = process.env.KEEPA_API_KEY ?? "";

const MISSING_KEY_MSG =
  "KEEPA_API_KEY is not set. Set the environment variable before using this tool. " +
  "Get a key at https://keepa.com/#!api (free tier: 100 tokens/minute). " +
  "Then re-launch with: KEEPA_API_KEY=your_key npx keepa-mcp";

function requireKey(): string {
  if (!KEEPA_API_KEY) return "";
  return KEEPA_API_KEY;
}

// --------------------------------------------------------------------------
// Helper: wrap tool runner to return a message when key is missing
// --------------------------------------------------------------------------

async function withKey<TParams>(
  params: TParams,
  fn: (p: TParams, key: string) => Promise<string>
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const key = requireKey();
  if (!key) {
    return {
      content: [{ type: "text", text: MISSING_KEY_MSG }],
      isError: true,
    };
  }
  try {
    const text = await fn(params, key);
    return { content: [{ type: "text", text }] };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
}

// --------------------------------------------------------------------------
// MCP server setup
// --------------------------------------------------------------------------

const server = new McpServer({
  name: "keepa-mcp",
  version: "0.1.1",
});

// ----- get_product ----------------------------------------------------------

server.registerTool(
  "get_product",
  {
    title: "Get Product Details",
    description: `Fetch current product details from Keepa for a given Amazon ASIN.

Returns: title, brand, category path, current Amazon price, new (3P) price, buy box price,
review count, star rating, number of new offers, and latest sales rank.

Prices are in USD. A value of "N/A" means the price type is not currently available.

Args:
  - asin (string): Amazon ASIN, e.g. "B08N5WRWNW"
  - domain (number, optional): Keepa domain id (default 1 = amazon.com)

Examples:
  - "What is the current price of ASIN B08N5WRWNW?" -> use get_product with asin="B08N5WRWNW"
  - "Show me product details for B07PXGQC1Q" -> use get_product with asin="B07PXGQC1Q"

Error handling:
  - Returns an instructional message if KEEPA_API_KEY is missing.
  - Returns a not-found message for invalid ASINs.`,
    inputSchema: GetProductInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => withKey(params, runGetProduct)
);

// ----- get_price_history ----------------------------------------------------

server.registerTool(
  "get_price_history",
  {
    title: "Get Price History",
    description: `Fetch historical price data for an Amazon ASIN from Keepa.

Returns a decoded, downsampled time series (at most 60 data points) for:
  - Amazon price (sold by Amazon directly)
  - New (3P) price (lowest new third-party price)
  - Used price (lowest used price)
  - Buy box price

Keepa stores prices in cents. All prices returned are in USD.
Keepa time values (minutes since 2011-01-01) are decoded to ISO dates.

Args:
  - asin (string): Amazon ASIN
  - range (string, optional): Time range. "30d", "6m", "1y", "all". Default: "90d"
  - domain (number, optional): Keepa domain id (default 1 = amazon.com)

Examples:
  - "Show price history for B08N5WRWNW over the past year" -> range="1y"
  - "What has the Amazon price been for B07PXGQC1Q in the last 30 days?" -> range="30d"`,
    inputSchema: GetPriceHistoryInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => withKey(params, runGetPriceHistory)
);

// ----- get_sales_rank_history -----------------------------------------------

server.registerTool(
  "get_sales_rank_history",
  {
    title: "Get Sales Rank History",
    description: `Fetch historical sales rank data for an Amazon ASIN from Keepa.

Sales rank (BSR) is a proxy for demand: lower rank = faster sales velocity.
Returns a decoded, downsampled time series plus a trend summary.

The trend summary indicates whether demand is improving (rank decreasing),
worsening (rank increasing), or stable.

Args:
  - asin (string): Amazon ASIN
  - range (string, optional): Time range. "30d", "6m", "1y", "all". Default: "90d"
  - domain (number, optional): Keepa domain id (default 1 = amazon.com)

Examples:
  - "Is demand trending up or down for B08N5WRWNW?" -> use get_sales_rank_history
  - "Show 6-month BSR history for B07PXGQC1Q" -> range="6m"`,
    inputSchema: GetSalesRankHistoryInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => withKey(params, runGetSalesRankHistory)
);

// ----- search_products ------------------------------------------------------

server.registerTool(
  "search_products",
  {
    title: "Search Products",
    description: `Search for Amazon products on Keepa by keyword.

Returns a list of matching ASINs. Use get_product on any returned ASIN
to fetch full product details, prices, and history.

Args:
  - keyword (string): Search term, e.g. "wireless earbuds"
  - category_id (number, optional): Restrict to a Keepa category id.
  - domain (number, optional): Keepa domain id (default 1 = amazon.com)

Examples:
  - "Find products for 'yoga mat'" -> keyword="yoga mat"
  - "Search Electronics for 'USB-C hub'" -> keyword="USB-C hub", category_id=172282`,
    inputSchema: SearchProductsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => withKey(params, runSearchProducts)
);

// ----- get_best_sellers -----------------------------------------------------

server.registerTool(
  "get_best_sellers",
  {
    title: "Get Best Sellers",
    description: `Get the top-selling ASINs in a Keepa category.

Returns an ordered list of ASINs. Find category ids at:
  https://keepa.com/#!categorytree/1

Common category ids (amazon.com):
  - 172282: Electronics
  - 1055398: Computers & Accessories
  - 3760901: Camera & Photo
  - 2619533: Musical Instruments
  - 284507: Kitchen & Dining

Args:
  - category_id (number): Keepa category id
  - domain (number, optional): Keepa domain id (default 1 = amazon.com)

Examples:
  - "What are the best sellers in Electronics?" -> category_id=172282
  - "Top Kitchen products" -> category_id=284507`,
    inputSchema: GetBestSellersInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => withKey(params, runGetBestSellers)
);

// ----- get_deals ------------------------------------------------------------

server.registerTool(
  "get_deals",
  {
    title: "Get Deals",
    description: `Fetch current Amazon price-drop deals from Keepa.

Returns products where the price has dropped significantly, filtered by
minimum price drop percentage and minimum rating.

Args:
  - min_price_drop_pct (number, optional): Minimum % price drop (1-99). Default: 20
  - min_rating (number, optional): Min rating 0-50 (45 = 4.5 stars). Default: 40
  - page (number, optional): Page offset for pagination. Default: 0
  - domain (number, optional): Keepa domain id (default 1 = amazon.com)

Examples:
  - "Show me deals with at least 30% off" -> min_price_drop_pct=30
  - "Find highly-rated products on sale" -> min_rating=45, min_price_drop_pct=20`,
    inputSchema: GetDealsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => withKey(params, runGetDeals)
);

// --------------------------------------------------------------------------
// Start server
// --------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!KEEPA_API_KEY) {
    process.stderr.write(
      "[keepa-mcp] WARNING: KEEPA_API_KEY is not set. " +
        "Tools will return an instructional message until the key is provided.\n"
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[keepa-mcp] Server running via stdio.\n");
}

main().catch((err) => {
  process.stderr.write(`[keepa-mcp] Fatal error: ${err}\n`);
  process.exit(1);
});
