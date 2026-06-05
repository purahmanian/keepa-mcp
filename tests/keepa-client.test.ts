import { describe, it, expect } from "vitest";
import {
  keepaTimeToDate,
  dateToKeepaTime,
  decodeHistory,
  parseRange,
  computeTrendSummary,
} from "../src/services/keepa-client.js";
import { KEEPA_TIME_OFFSET } from "../src/constants.js";

describe("keepaTimeToDate", () => {
  it("converts 0 to the Keepa epoch start (2011-01-01 UTC approx)", () => {
    const date = keepaTimeToDate(0);
    // 0 + 21564000 minutes from Unix epoch = 2011-01-01T00:00:00Z
    const expected = new Date(KEEPA_TIME_OFFSET * 60 * 1000);
    expect(date.getTime()).toBe(expected.getTime());
  });

  it("round-trips through dateToKeepaTime", () => {
    const original = 26000000;
    const date = keepaTimeToDate(original);
    const roundTripped = dateToKeepaTime(date);
    expect(roundTripped).toBe(original);
  });
});

describe("decodeHistory", () => {
  it("returns empty array for null input", () => {
    expect(decodeHistory(null)).toEqual([]);
  });

  it("returns empty array for empty array", () => {
    expect(decodeHistory([])).toEqual([]);
  });

  it("skips negative values (-1 = unavailable)", () => {
    const csv = [26000000, -1, 26001440, 4999, 26002880, -1];
    const result = decodeHistory(csv);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(4999);
  });

  it("decodes alternating time/value pairs", () => {
    const csv = [26000000, 4999, 26001440, 4799, 26002880, 4999];
    const result = decodeHistory(csv);
    expect(result).toHaveLength(3);
    expect(result[0].value).toBe(4999);
    expect(result[1].value).toBe(4799);
    expect(result[2].value).toBe(4999);
    // Each date string should be valid ISO date
    expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("filters by date range", () => {
    // Create times spanning a known range
    const now = new Date();
    const t0 = Math.floor(now.getTime() / 60000) - KEEPA_TIME_OFFSET - 10000;
    const t1 = Math.floor(now.getTime() / 60000) - KEEPA_TIME_OFFSET - 5000;
    const t2 = Math.floor(now.getTime() / 60000) - KEEPA_TIME_OFFSET - 100;

    const csv = [t0, 1000, t1, 2000, t2, 3000];

    // Filter to only include t1 and t2 (last 6000 minutes range)
    const rangeStart = new Date(now.getTime() - 6000 * 60 * 1000);
    const result = decodeHistory(csv, rangeStart, now);

    expect(result.length).toBeGreaterThanOrEqual(1);
    // t0 should be excluded (older than rangeStart)
    expect(result.every((p) => p.value >= 2000)).toBe(true);
  });

  it("downsamples to MAX_HISTORY_POINTS (60) when series is long", () => {
    // Build a series of 200 points
    const csv: number[] = [];
    const base = 26000000;
    for (let i = 0; i < 200; i++) {
      csv.push(base + i * 1440, 5000 + i);
    }
    const result = decodeHistory(csv);
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("parseRange", () => {
  it('parses "30d" correctly', () => {
    const { start, end } = parseRange("30d");
    expect(start).toBeDefined();
    const diffDays =
      (end.getTime() - start!.getTime()) / (1000 * 60 * 60 * 24);
    expect(Math.round(diffDays)).toBe(30);
  });

  it('parses "6m" correctly', () => {
    const { start, end } = parseRange("6m");
    expect(start).toBeDefined();
    // 6 months is between 180 and 186 days
    const diffDays =
      (end.getTime() - start!.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(179);
    expect(diffDays).toBeLessThanOrEqual(186);
  });

  it('parses "1y" correctly', () => {
    const { start, end } = parseRange("1y");
    expect(start).toBeDefined();
    const diffDays =
      (end.getTime() - start!.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(364);
    expect(diffDays).toBeLessThanOrEqual(366);
  });

  it('returns undefined start for "all"', () => {
    const { start } = parseRange("all");
    expect(start).toBeUndefined();
  });

  it("defaults to 90d for unrecognised input", () => {
    const { start, end } = parseRange("unknown");
    expect(start).toBeDefined();
    const diffDays =
      (end.getTime() - start!.getTime()) / (1000 * 60 * 60 * 24);
    expect(Math.round(diffDays)).toBe(90);
  });
});

describe("computeTrendSummary", () => {
  it("returns insufficient data message for fewer than 2 points", () => {
    expect(computeTrendSummary([])).toContain("Insufficient");
    expect(computeTrendSummary([{ date: "2024-01-01", value: 1000 }])).toContain(
      "Insufficient"
    );
  });

  it("identifies improving trend (rank decreasing = better)", () => {
    const points = [
      { date: "2024-01-01", value: 50000 },
      { date: "2024-02-01", value: 20000 },
    ];
    const summary = computeTrendSummary(points);
    expect(summary.toLowerCase()).toContain("improving");
  });

  it("identifies worsening trend (rank increasing = worse)", () => {
    const points = [
      { date: "2024-01-01", value: 10000 },
      { date: "2024-02-01", value: 80000 },
    ];
    const summary = computeTrendSummary(points);
    // The message uses "worsened" (past tense) to describe the change
    expect(summary.toLowerCase()).toMatch(/worsen/);
  });

  it("identifies stable trend (less than 5% change)", () => {
    const points = [
      { date: "2024-01-01", value: 10000 },
      { date: "2024-02-01", value: 10200 },
    ];
    const summary = computeTrendSummary(points);
    expect(summary.toLowerCase()).toContain("stable");
  });
});
