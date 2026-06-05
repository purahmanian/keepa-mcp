import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load fixture files
const productFixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures/product.json"), "utf-8")
);
const searchFixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures/search.json"), "utf-8")
);
const bestsellersFixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures/bestsellers.json"), "utf-8")
);
const dealsFixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures/deals.json"), "utf-8")
);

// Mock global fetch before importing modules that use it
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockFetchResponse(data: unknown): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

function mockFetchError(status: number, statusText: string): void {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
  });
}

// Import tools after mock is set up
const { runGetProduct, buildProductSummary, formatProductSummary } =
  await import("../src/tools/get-product.js");
const { runGetPriceHistory } = await import(
  "../src/tools/get-price-history.js"
);
const { runGetSalesRankHistory } = await import(
  "../src/tools/get-sales-rank-history.js"
);
const { runSearchProducts } = await import("../src/tools/search-products.js");
const { runGetBestSellers } = await import("../src/tools/get-best-sellers.js");
const { runGetDeals } = await import("../src/tools/get-deals.js");

const FAKE_KEY = "test-api-key-12345";

describe("get_product tool", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns product summary for a valid ASIN", async () => {
    mockFetchResponse(productFixture);

    const result = await runGetProduct({ asin: "B08N5WRWNW", domain: 1 }, FAKE_KEY);

    expect(result).toContain("B08N5WRWNW");
    expect(result).toContain("Echo Dot");
    expect(result).toContain("Amazon");
    expect(result).toContain("Electronics");
    expect(result).toContain("$49.99");
  });

  it("returns not-found message when product list is empty", async () => {
    mockFetchResponse({ products: [], tokensLeft: 100 });

    const result = await runGetProduct({ asin: "INVALID123", domain: 1 }, FAKE_KEY);

    expect(result).toContain("No product found");
    expect(result).toContain("INVALID123");
  });

  it("returns error message on HTTP 402 (quota exceeded)", async () => {
    mockFetchError(402, "Payment Required");

    // The error is caught by withKey wrapper in index.ts but here we test raw runner
    await expect(
      runGetProduct({ asin: "B08N5WRWNW", domain: 1 }, FAKE_KEY)
    ).rejects.toThrow(/token quota/i);
  });

  it("surfaces Keepa's structured error body on HTTP 400", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () =>
        Promise.resolve({
          error: {
            message: "You used an invalid parameter for this API call.",
            type: "invalidParameter",
          },
        }),
    });

    await expect(
      runGetProduct({ asin: "B08N5WRWNW", domain: 1 }, FAKE_KEY)
    ).rejects.toThrow(/invalidParameter.*invalid parameter/i);
  });

  it("handles missing csv array gracefully", async () => {
    const noHistory = {
      products: [
        {
          ...productFixture.products[0],
          csv: undefined,
          current: undefined,
        },
      ],
    };
    mockFetchResponse(noHistory);

    const result = await runGetProduct({ asin: "B08N5WRWNW", domain: 1 }, FAKE_KEY);
    expect(result).toContain("B08N5WRWNW");
    expect(result).toContain("N/A");
  });
});

describe("buildProductSummary", () => {
  it("extracts prices from current array", () => {
    const product = productFixture.products[0];
    const summary = buildProductSummary(product);

    expect(summary.asin).toBe("B08N5WRWNW");
    expect(summary.current_price_amazon_cents).toBe(4999);
    expect(summary.current_price_new_cents).toBe(4899);
    expect(summary.buy_box_price_cents).toBe(4999);
    expect(summary.review_count).toBe(185432);
    expect(summary.rating).toBeCloseTo(4.6);
  });

  it("converts null/-1 prices to null", () => {
    const product = {
      ...productFixture.products[0],
      current: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    };
    const summary = buildProductSummary(product);

    expect(summary.current_price_amazon_cents).toBeNull();
    expect(summary.current_price_new_cents).toBeNull();
    expect(summary.buy_box_price_cents).toBeNull();
  });
});

describe("get_price_history tool", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns price history with decoded dates and USD prices", async () => {
    mockFetchResponse(productFixture);

    const result = await runGetPriceHistory(
      { asin: "B08N5WRWNW", range: "90d", domain: 1 },
      FAKE_KEY
    );

    expect(result).toContain("Price History");
    expect(result).toContain("B08N5WRWNW");
    expect(result).toContain("Amazon Price");
    expect(result).toContain("$");
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/); // ISO date present
  });

  it("handles product not found", async () => {
    mockFetchResponse({ products: [], tokensLeft: 100 });

    const result = await runGetPriceHistory(
      { asin: "NOTFOUND", range: "30d", domain: 1 },
      FAKE_KEY
    );

    expect(result).toContain("No product found");
  });

  it("handles null csv entries gracefully", async () => {
    const noHistory = {
      products: [
        {
          ...productFixture.products[0],
          csv: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
        },
      ],
    };
    mockFetchResponse(noHistory);

    const result = await runGetPriceHistory(
      { asin: "B08N5WRWNW", range: "90d", domain: 1 },
      FAKE_KEY
    );

    expect(result).toContain("no data in range");
  });
});

describe("get_sales_rank_history tool", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns sales rank history with trend summary", async () => {
    mockFetchResponse(productFixture);

    const result = await runGetSalesRankHistory(
      { asin: "B08N5WRWNW", range: "90d", domain: 1 },
      FAKE_KEY
    );

    expect(result).toContain("Sales Rank History");
    expect(result).toContain("Trend");
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("handles product not found", async () => {
    mockFetchResponse({ products: [] });

    const result = await runGetSalesRankHistory(
      { asin: "NOTFOUND", range: "30d", domain: 1 },
      FAKE_KEY
    );

    expect(result).toContain("No product found");
  });
});

describe("search_products tool", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns list of ASINs for a keyword search", async () => {
    mockFetchResponse(searchFixture);

    const result = await runSearchProducts(
      { keyword: "echo dot", domain: 1 },
      FAKE_KEY
    );

    expect(result).toContain("B08N5WRWNW");
    expect(result).toContain("echo dot");
    expect(result).toContain("5 ASINs");
  });

  it("returns not-found message for empty results", async () => {
    mockFetchResponse({ asinList: [] });

    const result = await runSearchProducts(
      { keyword: "xyzabcnonexistent", domain: 1 },
      FAKE_KEY
    );

    expect(result).toContain("No products found");
  });
});

describe("get_best_sellers tool", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns best seller ASINs for a category", async () => {
    mockFetchResponse(bestsellersFixture);

    const result = await runGetBestSellers(
      { category_id: 172282, domain: 1 },
      FAKE_KEY
    );

    expect(result).toContain("Best Sellers");
    expect(result).toContain("B08N5WRWNW");
    expect(result).toContain("172282");
  });

  it("returns not-found message for empty best sellers", async () => {
    mockFetchResponse({ bestSellersList: { asinList: [] } });

    const result = await runGetBestSellers(
      { category_id: 99999999, domain: 1 },
      FAKE_KEY
    );

    expect(result).toContain("No best sellers found");
  });
});

describe("get_deals tool", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns deal products with prices and ratings", async () => {
    mockFetchResponse(dealsFixture);

    const result = await runGetDeals(
      { min_price_drop_pct: 20, min_rating: 40, page: 0, domain: 1 },
      FAKE_KEY
    );

    expect(result).toContain("Deals");
    expect(result).toContain("Echo Dot");
    expect(result).toContain("$29.99");
    expect(result).toContain("B08N5WRWNW");
  });

  it("returns no-deals message when result is empty", async () => {
    mockFetchResponse({ dr: [] });

    const result = await runGetDeals(
      { min_price_drop_pct: 99, min_rating: 50, page: 0, domain: 1 },
      FAKE_KEY
    );

    expect(result).toContain("No deals found");
  });

  it("shows rating in formatted output", async () => {
    mockFetchResponse(dealsFixture);

    const result = await runGetDeals(
      { min_price_drop_pct: 20, min_rating: 40, page: 0, domain: 1 },
      FAKE_KEY
    );

    expect(result).toContain("4.6/5");
  });
});
