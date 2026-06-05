// Tool: get_price_history
// Decodes Keepa CSV price history for Amazon, new, used, buy-box prices.

import { z } from "zod";
import { fetchProduct, decodeHistory, parseRange } from "../services/keepa-client.js";
import { DEFAULT_DOMAIN, PRICE_TYPES } from "../constants.js";
import type { PriceHistoryResult, HistoryPoint } from "../types.js";

export const GetPriceHistoryInputSchema = z.object({
  asin: z.string().min(1).describe("Amazon ASIN"),
  range: z
    .string()
    .default("90d")
    .describe(
      'Time range for history. Examples: "30d" (30 days), "6m" (6 months), "1y" (1 year), "all" (full history). Default: 90d'
    ),
  domain: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(DEFAULT_DOMAIN)
    .describe("Keepa domain id (1 = amazon.com)"),
});

export type GetPriceHistoryInput = z.infer<typeof GetPriceHistoryInputSchema>;

function formatPriceSeries(points: HistoryPoint[]): string {
  if (points.length === 0) return "  (no data in range)";
  return points
    .map((p) => `  ${p.date}: $${(p.value / 100).toFixed(2)}`)
    .join("\n");
}

export function formatPriceHistory(result: PriceHistoryResult): string {
  const lines = [
    `# Price History: ${result.asin}`,
    `Range: ${result.range}`,
    "",
    "## Amazon Price",
    formatPriceSeries(result.amazon),
    "",
    "## New (3P) Price",
    formatPriceSeries(result.new),
    "",
    "## Used Price",
    formatPriceSeries(result.used),
    "",
    "## Buy Box Price",
    formatPriceSeries(result.buy_box),
    "",
    `_${result.note}_`,
  ];
  return lines.join("\n");
}

export async function runGetPriceHistory(
  params: GetPriceHistoryInput,
  apiKey: string
): Promise<string> {
  const product = await fetchProduct(params.asin, params.domain, apiKey);
  if (!product) {
    return `No product found for ASIN "${params.asin}".`;
  }

  const { start, end } = parseRange(params.range);
  const csv = product.csv ?? [];

  const result: PriceHistoryResult = {
    asin: params.asin,
    range: params.range,
    amazon: decodeHistory(csv[PRICE_TYPES.AMAZON], start, end),
    new: decodeHistory(csv[PRICE_TYPES.NEW], start, end),
    used: decodeHistory(csv[PRICE_TYPES.USED], start, end),
    buy_box: decodeHistory(csv[PRICE_TYPES.BUY_BOX], start, end),
    note:
      "Prices are in USD. Series downsampled to at most 60 data points. -1 values (unavailable) are excluded.",
  };

  return formatPriceHistory(result);
}
