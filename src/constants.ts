// Keepa API constants

export const KEEPA_API_BASE = "https://api.keepa.com";

// Keepa time offset: minutes since this epoch (2011-01-01 00:00:00 UTC)
// Convert to Unix timestamp: keepaMinutes + 21564000 gives minutes since Unix epoch
// Or: Date.ms = (keepaMinutes + 21564000) * 60 * 1000
export const KEEPA_TIME_OFFSET = 21564000; // minutes

// Default domain: 1 = amazon.com
export const DEFAULT_DOMAIN = 1;

// Maximum data points to return after downsampling history series
export const MAX_HISTORY_POINTS = 60;

// Maximum response size in characters
export const CHARACTER_LIMIT = 25000;

// Keepa CSV price indices for product data array
// Each price type occupies a slot in the csv array returned by Keepa
export const PRICE_TYPES = {
  AMAZON: 0,
  NEW: 1,
  USED: 2,
  SALES_RANK: 3,
  LIST_PRICE: 4,
  COLLECTIBLE: 5,
  REFURBISHED: 6,
  NEW_FBM: 7,
  BUY_BOX: 18,
} as const;
