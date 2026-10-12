import type { UTCTimestamp } from "lightweight-charts";

/** The ONE shape every chart type is built from. */
export type Candle = {
    time: UTCTimestamp; // UNIX seconds (NOT milliseconds)
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
};

/** Whatever your DB / API returns. Adjust the field names to your schema. */
export type RawRow = {
    ts: string | number | Date; // timestamp column
    open: number | string; // Postgres NUMERIC / Decimal often arrives as string
    high: number | string;
    low: number | string;
    close: number | string;
    volume?: number | string | null;
};

export const INTERVALS = ["1s", "1m", "5m", "15m", "1h", "4h", "1D", "1W"] as const;
export type Interval = (typeof INTERVALS)[number];

export const INTERVAL_SECONDS: Record<Interval, number> = {
    "1s": 0.1,
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "4h": 14400,
    "1D": 86400,
    "1W": 604800,
};

export function toUnixSeconds(v: string | number | Date): UTCTimestamp {
    if (typeof v === "number") return (v > 1e12 ? Math.floor(v / 1000) : v) as UTCTimestamp;
    const ms = v instanceof Date ? v.getTime() : Date.parse(v);
    return Math.floor(ms / 1000) as UTCTimestamp;
}

/**
 * DB rows -> chart-ready candles.
 * Lightweight Charts requires: ascending time, no duplicate times, numeric values.
 */
export function normalizeCandles(rows: RawRow[]): Candle[] {
    const sorted = rows
        .map((r) => ({
            time: toUnixSeconds(r.ts),
            open: Number(r.open),
            high: Number(r.high),
            low: Number(r.low),
            close: Number(r.close),
            volume: r.volume == null ? undefined : Number(r.volume),
        }))
        .filter((c) => [c.open, c.high, c.low, c.close].every(Number.isFinite))
        .sort((a, b) => a.time - b.time);

    // drop duplicate timestamps (keep the last one)
    return sorted.filter((c, i) => i === sorted.length - 1 || c.time !== sorted[i + 1].time);
}

/** Heikin-Ashi is derived from normal candles. */
export function toHeikinAshi(src: Candle[]): Candle[] {
    const out: Candle[] = [];
    src.forEach((c, i) => {
        const close = (c.open + c.high + c.low + c.close) / 4;
        const open = i === 0 ? (c.open + c.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2;
        out.push({
            time: c.time,
            open,
            close,
            high: Math.max(c.high, open, close),
            low: Math.min(c.low, open, close),
            volume: c.volume,
        });
    });
    return out;
}

/** Random-walk data so the chart works before your DB is connected. */
export function generateMockCandles(interval: Interval | string = "1D", count = 500): Candle[] {
    const step = INTERVAL_SECONDS[interval as Interval] ?? 86400;
    const end = Math.floor(Date.now() / 1000 / step) * step;
    let price = 100;
    const out: Candle[] = [];
    for (let i = count - 1; i >= 0; i--) {
        const open = price;
        const close = open * (1 + (Math.random() - 0.48) * 0.03);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        out.push({
            time: (end - i * step) as UTCTimestamp,
            open,
            high,
            low,
            close,
            volume: Math.round(1000 + Math.random() * 9000),
        });
        price = close;
    }
    return out;
}