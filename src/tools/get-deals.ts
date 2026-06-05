// Tool: get_deals
// Fetches current Amazon price-drop deals from Keepa.

import { z } from "zod";
import { fetchDeals } from "../services/keepa-client.js";
import { DEFAULT_DOMAIN } from "../constants.js";
import type { KeepaProduct } from "../types.js";

export const GetDealsInputSchema = z.object({
  min_price_drop_pct: z
    .number()
    .int()
    .min(1)
    .max(99)
    .default(20)
    .describe("Minimum price drop percentage to include. Default: 20"),
  min_rating: z
    .number()
    .int()
    .min(0)
    .max(50)
    .default(40)
    .describe(
      "Minimum product rating (0-50, where 45 = 4.5 stars). Default: 40"
    ),
  page: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Page offset for pagination. Default: 0 (first page)"),
  domain: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(DEFAULT_DOMAIN)
    .describe("Keepa domain id (1 = amazon.com)"),
});

export type GetDealsInput = z.infer<typeof GetDealsInputSchema>;

function formatDealProduct(p: KeepaProduct, index: number): string {
  const current = p.current ?? [];
  const amazonPrice = current[0] != null && current[0] > 0 ? current[0] : null;
  const priceStr =
    amazonPrice != null ? `$${(amazonPrice / 100).toFixed(2)}` : "N/A";
  const rating =
    p.reviews?.rating != null
      ? `${(p.reviews.rating / 10).toFixed(1)}/5`
      : "N/A";
  const reviews =
    p.reviews?.reviewCount != null
      ? `${p.reviews.reviewCount.toLocaleString()} reviews`
      : "N/A";

  return [
    `### ${index + 1}. ${p.title ?? "Unknown Title"}`,
    `- **ASIN:** ${p.asin}`,
    `- **Amazon Price:** ${priceStr}`,
    `- **Rating:** ${rating} (${reviews})`,
  ].join("\n");
}

export async function runGetDeals(
  params: GetDealsInput,
  apiKey: string
): Promise<string> {
  const result = await fetchDeals(
    params.domain,
    params.min_price_drop_pct,
    params.min_rating,
    params.page,
    apiKey
  );

  const deals = result.dr ?? [];
  if (deals.length === 0) {
    return "No deals found matching the current filters. Try lowering min_price_drop_pct or min_rating.";
  }

  const lines = [
    `# Current Deals (Page ${params.page})`,
    `Filters: min price drop ${params.min_price_drop_pct}%, min rating ${params.min_rating}/50`,
    `Found ${deals.length} deals.`,
    "",
    "## Deals",
    ...deals.map((p, i) => formatDealProduct(p, i)),
    "",
    "_Use get_product with any ASIN to see full price history and details._",
  ];

  return lines.join("\n");
}
