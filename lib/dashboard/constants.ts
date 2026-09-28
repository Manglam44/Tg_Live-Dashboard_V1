/**
 * Fixed row order for the Commodity screen.
 * Each name here gets exactly ONE row on the dashboard (see quotes.ts
 * `pickOriginalContract`) — the row never moves once it appears.
 */
export const COMMODITY_ORDER = [
    "GOLD",
    "SILVER",
    "CRUDE OIL",
    "BRENT",
    "COPPER",
    "NATURAL GAS",
    "ALUMINIUM",
    "ZINC",
    "LEAD",
    "NICKEL",
    "COTTON",
    "COCOA",
    "SUGAR",
    "COFFEE",
    "RICE",
    "WHEAT",
    "CORN",
    "SOYBEANS",
    "CRUDE PALM OIL FUTURES",
] as const;

/**
 * Fixed row order for the Currency screen.
 */
export const CURRENCY_ORDER = [
    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "USDCHF",
    "AUDUSD",
    "USDCAD",
    "NZDUSD",
    "EURGBP",
    "EURJPY",
    "GBPJPY",
    "AUDJPY",
    "USDINR",
] as const;

/** Milliseconds between poll cycles. */
export const REFRESH_INTERVAL_MS = 1000;

/**
 * A quote older than this is treated as stale even if the request
 * that returned it technically succeeded (e.g. feed frozen upstream).
 */
export const STALE_QUOTE_MS = 8000;

/** Consecutive failed/stale poll cycles before we surface the warning modal. */
export const FAILURE_THRESHOLD = 2;
