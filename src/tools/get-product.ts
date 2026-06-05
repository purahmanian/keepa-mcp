// Tool: get_product
// Returns product summary: title, brand, category, current prices, buy box, reviews.

import { z } from "zod";
import { fetchProduct } from "../services/keepa-client.js";
import { DEFAULT_DOMAIN, PRICE_TYPES } from "../constants.js";
import type { ProductSummary, KeepaProduct } from "../types.js";

export const GetProductInputSchema = z.object({
  asin: z
    .string()
    .min(1)
    .describe("Amazon ASIN or product code (e.g. B08N5WRWNW)"),
  domain: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(DEFAULT_DOMAIN)
    .describe(
      "Keepa domain id: 1=amazon.com, 2=amazon.co.uk, 3=amazon.de, 4=amazon.fr, 5=amazon.co.jp, 6=amazon.ca, 8=amazon.it, 9=amazon.es, 10=amazon.in"
    ),
});

export type GetProductInput = z.infer<typeof GetProductInputSchema>;

function centsOrNull(value: number | undefined): number | null {
  if (value === undefined || value < 0) return null;
  return value;
}

export function buildProductSummary(product: KeepaProduct): ProductSummary {
  const current = product.current ?? [];
  const csv = product.csv ?? [];

  // current[] indices match PRICE_TYPES constants
  const amazonPrice = centsOrNull(current[PRICE_TYPES.AMAZON]);
  const newPrice = centsOrNull(current[PRICE_TYPES.NEW]);
  const buyBox = centsOrNull(current[PRICE_TYPES.BUY_BOX]);

  const salesRankArr = csv[PRICE_TYPES.SALES_RANK];
  const latestRank =
    salesRankArr && salesRankArr.length >= 2
      ? salesRankArr[salesRankArr.length - 1]
      : null;

  const category =
    product.categoryTree?.map((c) => c.name).join(" > ") ??
    product.productGroup ??
    "Unknown";

  return {
    asin: product.asin,
    title: product.title ?? "Unknown",
    brand: product.brand ?? product.manufacturer ?? "Unknown",
    category,
    current_price_amazon_cents: amazonPrice,
    current_price_new_cents: newPrice,
    buy_box_price_cents: buyBox,
    review_count: product.reviews?.reviewCount ?? null,
    rating: product.reviews?.rating != null ? product.reviews.rating / 10 : null,
    new_offer_count: product.newOfferCount ?? null,
    sales_rank: latestRank && latestRank > 0 ? latestRank : null,
  };
}

export function formatProductSummary(s: ProductSummary): string {
  const fmt = (cents: number | null) =>
    cents == null ? "N/A" : `$${(cents / 100).toFixed(2)}`;

  const lines = [
    `# Product: ${s.title}`,
    "",
    `**ASIN:** ${s.asin}`,
    `**Brand:** ${s.brand}`,
    `**Category:** ${s.category}`,
    "",
    "## Pricing",
    `- Amazon price: ${fmt(s.current_price_amazon_cents)}`,
    `- New (3P) price: ${fmt(s.current_price_new_cents)}`,
    `- Buy box price: ${fmt(s.buy_box_price_cents)}`,
    "",
    "## Reviews",
    `- Rating: ${s.rating != null ? `${s.rating.toFixed(1)} / 5` : "N/A"}`,
    `- Review count: ${s.review_count ?? "N/A"}`,
    "",
    "## Marketplace",
    `- New offer count: ${s.new_offer_count ?? "N/A"}`,
    `- Sales rank: ${s.sales_rank ?? "N/A"}`,
  ];

  return lines.join("\n");
}

export async function runGetProduct(
  params: GetProductInput,
  apiKey: string
): Promise<string> {
  const product = await fetchProduct(params.asin, params.domain, apiKey);
  if (!product) {
    return `No product found for ASIN "${params.asin}". Verify the ASIN is correct and available on the selected Amazon domain.`;
  }
  const summary = buildProductSummary(product);
  return formatProductSummary(summary);
}
