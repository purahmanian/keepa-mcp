// Keepa API client with token-aware fetch

import {
  KEEPA_API_BASE,
  KEEPA_TIME_OFFSET,
  MAX_HISTORY_POINTS,
} from "../constants.js";
import type {
  KeepaProductResponse,
  KeepaSearchResponse,
  KeepaDealsResponse,
  HistoryPoint,
  KeepaProduct,
} from "../types.js";

// --------------------------------------------------------------------------
// Time utilities
// --------------------------------------------------------------------------

/**
 * Convert a Keepa time value (minutes since Keepa epoch) to a JS Date.
 * Keepa epoch offset: 21564000 minutes before the Unix epoch start.
 */
export function keepaTimeToDate(keepaMinutes: number): Date {
  const unixMs = (keepaMinutes + KEEPA_TIME_OFFSET) * 60 * 1000;
  return new Date(unixMs);
}

/**
 * Convert a JS Date to Keepa time (minutes since Keepa epoch).
 */
export function dateToKeepaTime(date: Date): number {
  return Math.floor(date.getTime() / 60000) - KEEPA_TIME_OFFSET;
}

// --------------------------------------------------------------------------
// History decoding + downsampling
// --------------------------------------------------------------------------

/**
 * Decode a Keepa CSV history array into an array of {date, value} points.
 * The array alternates: [keepaTime0, value0, keepaTime1, value1, ...].
 * Values of -1 (or -2) indicate "not available" and are skipped.
 *
 * The result is downsampled to at most MAX_HISTORY_POINTS data points
 * by picking evenly spaced indices when the series is longer.
 */
export function decodeHistory(
  csv: number[] | null | undefined,
  rangeStart?: Date,
  rangeEnd?: Date
): HistoryPoint[] {
  if (!csv || csv.length < 2) return [];

  const points: HistoryPoint[] = [];
  for (let i = 0; i + 1 < csv.length; i += 2) {
    const keepaTime = csv[i];
    const value = csv[i + 1];
    if (value < 0) continue; // -1 = unavailable

    const date = keepaTimeToDate(keepaTime);
    if (rangeStart && date < rangeStart) continue;
    if (rangeEnd && date > rangeEnd) continue;

    points.push({
      date: date.toISOString().slice(0, 10),
      value,
    });
  }

  return downsample(points, MAX_HISTORY_POINTS);
}

/**
 * Evenly downsample an array to at most maxPoints entries.
 * Always keeps the first and last entries.
 */
function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;

  const result: T[] = [];
  const step = (arr.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    result.push(arr[Math.round(i * step)]);
  }
  return result;
}

// --------------------------------------------------------------------------
// Range parsing
// --------------------------------------------------------------------------

/**
 * Parse a human range string like "30d", "90d", "1y", "6m", "all"
 * into {start, end} Date objects. Returns undefined start for "all".
 */
export function parseRange(range: string): { start?: Date; end: Date } {
  const end = new Date();
  const lower = range.toLowerCase().trim();

  if (lower === "all") return { end };

  const match = lower.match(/^(\d+)(d|m|y)$/);
  if (!match) {
    // Default to 90 days for unrecognised input
    const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  const num = parseInt(match[1], 10);
  const unit = match[2];
  const start = new Date(end);

  if (unit === "d") start.setDate(start.getDate() - num);
  else if (unit === "m") start.setMonth(start.getMonth() - num);
  else if (unit === "y") start.setFullYear(start.getFullYear() - num);

  return { start, end };
}

// --------------------------------------------------------------------------
// Trend summary helper
// --------------------------------------------------------------------------

/**
 * Return a simple linear trend description for a history series.
 */
export function computeTrendSummary(points: HistoryPoint[]): string {
  if (points.length < 2) return "Insufficient data to determine trend.";

  const first = points[0].value;
  const last = points[points.length - 1].value;
  const delta = last - first;
  const pct = ((delta / first) * 100).toFixed(1);

  if (Math.abs(delta) < first * 0.05) {
    return `Rank relatively stable (${first} to ${last}, ${pct}% change). Suggests steady demand.`;
  }
  if (delta < 0) {
    return `Rank improved from ${first} to ${last} (${pct}% change). Improving trend suggests rising demand.`;
  }
  return `Rank worsened from ${first} to ${last} (+${pct}% change). Rising rank suggests weakening demand.`;
}

// --------------------------------------------------------------------------
// HTTP fetch wrapper
// --------------------------------------------------------------------------

export async function keepaFetch<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  apiKey: string
): Promise<T> {
  const url = new URL(`${KEEPA_API_BASE}${path}`);
  url.searchParams.set("key", apiKey);

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    if (response.status === 400) {
      throw new Error(
        "Bad request (400). Check that your ASIN, category id, or query is valid."
      );
    }
    if (response.status === 402) {
      throw new Error(
        "Keepa token quota exceeded (402). Wait for your token bucket to refill (typically 1 minute)."
      );
    }
    if (response.status === 429) {
      throw new Error(
        "Rate limited by Keepa (429). Slow down requests or upgrade your plan."
      );
    }
    throw new Error(
      `Keepa API error: HTTP ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

// --------------------------------------------------------------------------
// Public API helpers used by tools
// --------------------------------------------------------------------------

export async function fetchProduct(
  asin: string,
  domain: number,
  apiKey: string,
  stats?: number
): Promise<KeepaProduct | null> {
  const params: Record<string, string | number> = {
    domain,
    asin,
    history: 1,
    offers: 20,
  };
  if (stats !== undefined) params.stats = stats;

  const data = await keepaFetch<KeepaProductResponse>(
    "/product",
    params,
    apiKey
  );
  return data.products?.[0] ?? null;
}

export async function searchProducts(
  term: string,
  domain: number,
  categoryId: number | undefined,
  apiKey: string
): Promise<KeepaSearchResponse> {
  const params: Record<string, string | number | undefined> = {
    domain,
    type: "product",
    term,
    ...(categoryId !== undefined ? { catid: categoryId } : {}),
  };
  return keepaFetch<KeepaSearchResponse>("/search", params, apiKey);
}

export async function fetchBestSellers(
  categoryId: number,
  domain: number,
  apiKey: string
): Promise<string[]> {
  const data = await keepaFetch<{ bestSellersList?: { asinList?: string[] } }>(
    "/bestsellers",
    { domain, category: categoryId },
    apiKey
  );
  return data.bestSellersList?.asinList ?? [];
}

export async function fetchDeals(
  domainId: number,
  priceDropPct: number,
  minRating: number,
  page: number,
  apiKey: string
): Promise<KeepaDealsResponse> {
  return keepaFetch<KeepaDealsResponse>(
    "/deal",
    {
      domain: domainId,
      page,
      "dealCondition[0]": 1, // new
      "priceTypes[0]": 0, // Amazon price
      "deltaDroppedPct[0]": priceDropPct,
      "rating[0]": minRating,
    },
    apiKey
  );
}
