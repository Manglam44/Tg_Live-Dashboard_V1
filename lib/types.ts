export type Mode = "live" | "delayed";

export interface MarketQuote {
    ticker_time: string;
    ticker_time_zone: string;
    mode: string;
    asset_class: string;
    instrument_type: string;
    name: string | null;
    symbol: string | null;
    pair: string | null;
    exchange: string | null;
    expiry: string | null;
    strike: number | null;
    right: string | null;
    underlying: string | null;
    bid: number | null;
    ask: number | null;
    last: number | null;
    bid_size: number | null;
    ask_size: number | null;
    last_size: number | null;
}

export function displaySymbol(q: MarketQuote): string {
    return q.symbol ?? q.pair ?? q.name ?? q.underlying ?? "—";
}

function normalized(value: string | null | undefined): string {
    return String(value ?? "").trim().toUpperCase();
}

/**
 * Identifies a contract/instrument, not an individual tick.
 * Exchange + underlying + expiry/strike/right are included so different
 * contracts cannot collapse into one row.
 */
export function keyOf(q: MarketQuote): string {
    return [
        normalized(q.asset_class),
        normalized(q.exchange),
        normalized(q.underlying),
        normalized(q.name),
        normalized(q.symbol ?? q.pair),
        normalized(q.instrument_type),
        normalized(q.expiry),
        q.strike ?? "",
        normalized(q.right),
    ].join("|");
}

export function price(v: number | null): string {
    return v == null
        ? "—"
        : v.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function size(v: number | null): string {
    return v == null
        ? "—"
        : v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function time(v: string): string {
    const d = new Date(v);
    return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
          });
}