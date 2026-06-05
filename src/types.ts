// TypeScript interfaces for Keepa API responses

export interface KeepaProduct {
  asin: string;
  title: string;
  brand?: string;
  manufacturer?: string;
  categoryTree?: Array<{ catId: number; name: string }>;
  rootCategory?: number;
  type?: number;
  imagesCSV?: string;
  // Current prices (in cents; -1 means not available)
  current?: number[];
  // Historical CSV arrays; each is [keepaTime, price, keepaTime, price, ...]
  csv?: Array<number[] | null>;
  // Review data
  reviews?: {
    rating?: number;
    reviewCount?: number;
  };
  // Buy box seller
  buyBoxSellerId?: string;
  buyBoxUsedPrice?: number;
  buyBoxNewIsAmazon?: boolean;
  // Number of new/used offers
  newOfferCount?: number;
  usedOfferCount?: number;
  // Sales rank
  salesRankReference?: number;
  salesRankReferenceHistory?: number[];
  // EAN / UPC codes
  eanList?: string[];
  upcList?: string[];
  partNumber?: string;
  // Product group / category string
  productGroup?: string;
  // Package dimensions
  packageLength?: number;
  packageWidth?: number;
  packageHeight?: number;
  packageWeight?: number;
}

export interface KeepaProductResponse {
  products: KeepaProduct[];
  tokensLeft?: number;
  refillIn?: number;
  refillRate?: number;
  timestamp?: number;
}

export interface KeepaSearchResponse {
  asinList?: string[];
  products?: KeepaProduct[];
  totalResults?: number;
  tokensLeft?: number;
}

export interface KeepaDealsResponse {
  dr?: KeepaProduct[];
  tokensLeft?: number;
}

export interface HistoryPoint {
  date: string;
  value: number;
}

export interface PriceHistoryResult {
  asin: string;
  range: string;
  amazon: HistoryPoint[];
  new: HistoryPoint[];
  used: HistoryPoint[];
  buy_box: HistoryPoint[];
  note: string;
}

export interface SalesRankHistoryResult {
  asin: string;
  range: string;
  sales_rank: HistoryPoint[];
  trend_summary: string;
}

export interface ProductSummary {
  asin: string;
  title: string;
  brand: string;
  category: string;
  current_price_amazon_cents: number | null;
  current_price_new_cents: number | null;
  buy_box_price_cents: number | null;
  review_count: number | null;
  rating: number | null;
  new_offer_count: number | null;
  sales_rank: number | null;
}
