import type { MarketQuote, Mode } from "@/lib/types";
import { fastapiGet } from "@/lib/server/fastapi-client";

/** See the comment in lib/server/market/commodity.ts re: reused historical path. */
const CURRENCY_PATH = "/questdb/currency";

export async function getCurrencyQuotes(mode: Mode, limit: number): Promise<MarketQuote[]> {
    return fastapiGet<MarketQuote[]>(CURRENCY_PATH, { mode, limit });
}
