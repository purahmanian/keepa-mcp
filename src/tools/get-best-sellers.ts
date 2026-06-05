// Tool: get_best_sellers
// Retrieves the top ASINs in a given Keepa category.

import { z } from "zod";
import { fetchBestSellers } from "../services/keepa-client.js";
import { DEFAULT_DOMAIN } from "../constants.js";

export const GetBestSellersInputSchema = z.object({
  category_id: z
    .number()
    .int()
    .describe(
      "Keepa category id (e.g. 172282 for Electronics on amazon.com). Find ids in the Keepa category tree at https://keepa.com/#!categorytree/1"
    ),
  domain: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(DEFAULT_DOMAIN)
    .describe("Keepa domain id (1 = amazon.com)"),
});

export type GetBestSellersInput = z.infer<typeof GetBestSellersInputSchema>;

export async function runGetBestSellers(
  params: GetBestSellersInput,
  apiKey: string
): Promise<string> {
  const asinList = await fetchBestSellers(
    params.category_id,
    params.domain,
    apiKey
  );

  if (asinList.length === 0) {
    return `No best sellers found for category id ${params.category_id}. Verify the category id is valid for this domain.`;
  }

  const lines = [
    `# Best Sellers: Category ${params.category_id}`,
    `Total ASINs: ${asinList.length}`,
    "",
    "## Top ASINs",
    ...asinList.slice(0, 100).map((asin, i) => `${i + 1}. ${asin}`),
    "",
    "_Use get_product with any ASIN above to fetch full product details, prices, and sales rank history._",
  ];

  return lines.join("\n");
}
