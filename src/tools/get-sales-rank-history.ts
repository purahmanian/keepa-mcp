// Tool: get_sales_rank_history
// Decodes Keepa sales rank CSV history and returns a trend summary.

import { z } from "zod";
import {
  fetchProduct,
  decodeHistory,
  parseRange,
  computeTrendSummary,
} from "../services/keepa-client.js";
import { DEFAULT_DOMAIN, PRICE_TYPES } from "../constants.js";
import type { SalesRankHistoryResult, HistoryPoint } from "../types.js";

export const GetSalesRankHistoryInputSchema = z.object({
  asin: z.string().min(1).describe("Amazon ASIN"),
  range: z
    .string()
    .default("90d")
    .describe(
      'Time range for history. Examples: "30d", "6m", "1y", "all". Default: 90d'
    ),
  domain: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(DEFAULT_DOMAIN)
    .describe("Keepa domain id (1 = amazon.com)"),
});

export type GetSalesRankHistoryInput = z.infer<
  typeof GetSalesRankHistoryInputSchema
>;

function formatRankSeries(points: HistoryPoint[]): string {
  if (points.length === 0) return "  (no data in range)";
  return points.map((p) => `  ${p.date}: ${p.value.toLocaleString()}`).join("\n");
}

export function formatSalesRankHistory(result: SalesRankHistoryResult): string {
  const lines = [
    `# Sales Rank History: ${result.asin}`,
    `Range: ${result.range}`,
    "",
    `**Trend:** ${result.trend_summary}`,
    "",
    "## Sales Rank Over Time",
    formatRankSeries(result.sales_rank),
    "",
    "_Lower rank number = higher sales velocity. Series downsampled to at most 60 data points._",
  ];
  return lines.join("\n");
}

export async function runGetSalesRankHistory(
  params: GetSalesRankHistoryInput,
  apiKey: string
): Promise<string> {
  const product = await fetchProduct(params.asin, params.domain, apiKey);
  if (!product) {
    return `No product found for ASIN "${params.asin}".`;
  }

  const { start, end } = parseRange(params.range);
  const csv = product.csv ?? [];

  const rankPoints = decodeHistory(csv[PRICE_TYPES.SALES_RANK], start, end);
  const trend = computeTrendSummary(rankPoints);

  const result: SalesRankHistoryResult = {
    asin: params.asin,
    range: params.range,
    sales_rank: rankPoints,
    trend_summary: trend,
  };

  return formatSalesRankHistory(result);
}
