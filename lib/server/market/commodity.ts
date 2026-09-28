import type { MarketQuote, Mode } from "@/lib/types";
import { fastapiGet } from "@/lib/server/fastapi-client";

/**
 * Backend path for commodity quotes.
 *
 * Per current backend design there is no separate historical endpoint yet —
 * the same path is reused for historical data: when `mode=delayed` the
 * FastAPI service returns the latest non-live snapshot rather than a live
 * tick. If/when a dedicated historical route is added, swap it in here only
 * — no caller outside this file needs to change.
 */
const COMMODITY_PATH = "/questdb/commodity";

export async function getCommodityQuotes(mode: Mode, limit: number): Promise<MarketQuote[]> {
    return fastapiGet<MarketQuote[]>(COMMODITY_PATH, { mode, limit });
}
