import type { MarketQuote, Mode } from "@/lib/types";
import { fastapiGet } from "@/lib/server/fastapi-client";

const COMMODITY_PATH = "/questdb/commodity";

export async function getCommodityQuotes(
    mode: Mode,
    limit: number
): Promise<MarketQuote[]> {
    return fastapiGet<MarketQuote[]>(
        COMMODITY_PATH,
        {
            mode,
            limit,
        }
    );
}