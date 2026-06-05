// Tool: search_products
// Searches Keepa for products matching a keyword query.

import { z } from "zod";
import { searchProducts as apiSearch } from "../services/keepa-client.js";
import { DEFAULT_DOMAIN } from "../constants.js";

export const SearchProductsInputSchema = z.object({
  keyword: z
    .string()
    .min(1)
    .describe("Search keyword or phrase (e.g. 'wireless earbuds')"),
  category_id: z
    .number()
    .int()
    .optional()
    .describe(
      "Optional Keepa category id to restrict results. Find ids via get_best_sellers or Keepa category tree."
    ),
  domain: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(DEFAULT_DOMAIN)
    .describe("Keepa domain id (1 = amazon.com)"),
});

export type SearchProductsInput = z.infer<typeof SearchProductsInputSchema>;

export async function runSearchProducts(
  params: SearchProductsInput,
  apiKey: string
): Promise<string> {
  const result = await apiSearch(
    params.keyword,
    params.domain,
    params.category_id,
    apiKey
  );

  const asinList = result.asinList ?? [];
  if (asinList.length === 0) {
    return `No products found for keyword "${params.keyword}". Try a broader search term or a different domain.`;
  }

  const lines = [
    `# Product Search Results: "${params.keyword}"`,
    `Found ${asinList.length} ASINs.`,
    "",
    "## ASIN List",
    ...asinList.map((asin, i) => `${i + 1}. ${asin}`),
    "",
    "_Use get_product with any ASIN above to fetch full product details._",
  ];

  return lines.join("\n");
}
