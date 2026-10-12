import { questdb } from "./questdb";
import { INTERVAL_SECONDS, type Interval, type RawRow } from "./chart-data";

export const TABLE = "commodity_live";
export const TS_COL = "quote_time"; // stored in UTC

/**
 * Calibration knob. Leave at 0 when ticker_time is true UTC.
 * If the chart is still off by a fixed amount, set TICKER_TIME_OFFSET_SEC
 * (e.g. 19800 = +5h30m, -19800 = -5h30m) in .env.local.
 */
const OFFSET_MS = Number(process.env.TICKER_TIME_OFFSET_SEC ?? 0) * 1000;

/** UI interval -> QuestDB SAMPLE BY unit. Only whitelisted values ever reach SQL. */
export const SAMPLE_BY: Record<string, string> = {
    "1s": "1s", "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h", "1D": "1d", "1W": "1w",
};
// INTERVAL_SECONDS["1s"] is 0.1 in chart-data; windows below need at least 1s
const stepSec = (i: Interval) => Math.max(INTERVAL_SECONDS[i], 1);
export const sampleUnit = (interval: string) =>
    Object.hasOwn(SAMPLE_BY, interval) ? SAMPLE_BY[interval] : undefined;

// `last` is also a QuestDB function name, so the column is double-quoted.
// Volume = number of quotes in the bucket (tick volume).
const CANDLE_SELECT = `SELECT ${TS_COL},
  first("last") AS open, max("last") AS high,
  min("last")   AS low,  last("last") AS close,
  count()       AS volume`;

/**
 * Ordered subquery + TIMESTAMP(): makes SAMPLE BY work (real aggregation, one row per
 * bucket) no matter which column is the table's designated timestamp.
 * Buckets are plain UTC; the chart formats them as IST.
 */
const source = (fromIso: string) => `FROM (
    SELECT ${TS_COL}, "last" FROM ${TABLE}
    WHERE symbol = $1 AND expiry = $2 AND "last" > 0 AND ${TS_COL} >= '${fromIso}'
    ORDER BY ${TS_COL}
  ) TIMESTAMP(${TS_COL})`;

export const toRaw = (r: Record<string, unknown>): RawRow => ({
    ts: new Date(new Date(r[TS_COL] as string | Date).getTime() + OFFSET_MS).toISOString(),
    open: r.open as number,
    high: r.high as number,
    low: r.low as number,
    close: r.close as number,
    volume: r.volume as number | string, // int8 arrives as string; normalizeCandles converts
});

/** Chart ONE futures contract: the requested expiry, else the front month. */
export async function resolveExpiry(symbol: string, requested: string | null) {
    if (requested) return requested;

    const recent = await questdb.query(
        `SELECT DISTINCT expiry FROM ${TABLE}
     WHERE symbol = $1 AND ${TS_COL} > dateadd('d', -7, now())
     ORDER BY expiry LIMIT 1`,
        [symbol],
    );
    if (recent.rows[0]?.expiry) return String(recent.rows[0].expiry);

    const latest = await questdb.query(
        `SELECT expiry FROM ${TABLE} WHERE symbol = $1 ORDER BY ${TS_COL} DESC LIMIT 1`,
        [symbol],
    );
    return latest.rows[0]?.expiry ? String(latest.rows[0].expiry) : null;
}

/** Time of the newest tick. Windows are anchored here, not to now(), so a clock/timezone
 *  mismatch or a closed market can never produce an empty chart. */
async function latestTick(symbol: string, expiry: string): Promise<number | null> {
    const { rows } = await questdb.query(
        `SELECT ${TS_COL} FROM ${TABLE}
     WHERE symbol = $1 AND expiry = $2 AND "last" > 0
     ORDER BY ${TS_COL} DESC LIMIT 1`,
        [symbol, expiry],
    );
    return rows[0] ? new Date(rows[0][TS_COL]).getTime() : null;
}

/** History: the latest `maxBars` candles of `interval` (window sized from the interval, ending at the newest tick). */
export async function fetchCandles(
    symbol: string, expiry: string, interval: Interval, maxBars: number,
): Promise<RawRow[]> {
    const end = await latestTick(symbol, expiry);
    if (end == null) return [];
    const from = new Date(end - maxBars * stepSec(interval) * 2 * 1000).toISOString(); // x2 covers market-closed gaps
    const { rows } = await questdb.query(
        `${CANDLE_SELECT}
     ${source(from)}
     SAMPLE BY ${sampleUnit(interval)} ALIGN TO CALENDAR
     LIMIT -${maxBars}`,
        [symbol, expiry],
    );
    return rows.map(toRaw);
}

/** Live: the newest (still forming) candle. Scans only the last 3 buckets. */
export async function fetchLatestCandle(
    symbol: string, expiry: string, interval: Interval,
): Promise<RawRow | null> {
    const end = await latestTick(symbol, expiry);
    if (end == null) return null;
    const from = new Date(end - stepSec(interval) * 3 * 1000).toISOString();
    const { rows } = await questdb.query(
        `${CANDLE_SELECT}
     ${source(from)}
     SAMPLE BY ${sampleUnit(interval)} ALIGN TO CALENDAR
     LIMIT -1`,
        [symbol, expiry],
    );
    return rows[0] ? toRaw(rows[0]) : null;
}