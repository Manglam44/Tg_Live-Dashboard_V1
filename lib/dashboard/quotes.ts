import type { MarketQuote } from "@/lib/types";
import { keyOf } from "@/lib/types";

export function normalize(value: string | null | undefined): string {
    return (value ?? "").trim().toUpperCase();
}

export function instrumentName(quote: MarketQuote): string {
    return normalize(
        quote.name || quote.underlying || quote.symbol || quote.pair
    );
}

/**
 * Keeps ONE quote per contract (dashboard summary use case).
 * Key has no ticker_time, so this is NOT safe for building a
 * time series — use deduplicateTicks() for that instead.
 */
export function deduplicateQuotes(quotes: MarketQuote[]): MarketQuote[] {
    const map = new Map<string, MarketQuote>();

    for (const quote of quotes) {
        const key = keyOf(quote);
        const existing = map.get(key);

        if (!existing) {
            map.set(key, quote);
            continue;
        }

        const oldTime = new Date(existing.ticker_time).getTime();
        const newTime = new Date(quote.ticker_time).getTime();

        if (
            Number.isNaN(oldTime) ||
            (!Number.isNaN(newTime) && newTime >= oldTime)
        ) {
            map.set(key, quote);
        }
    }

    return Array.from(map.values());
}

/**
 * Removes exact duplicate ticks (same contract + same ticker_time),
 * e.g. from overlapping polls. Unlike deduplicateQuotes(), this keeps
 * the full time series per contract — required for history/chart views.
 */
export function deduplicateTicks(quotes: MarketQuote[]): MarketQuote[] {
    const seen = new Set<string>();
    const result: MarketQuote[] = [];

    for (const quote of quotes) {
        const key = `${keyOf(quote)}|${quote.ticker_time}`;

        if (!seen.has(key)) {
            seen.add(key);
            result.push(quote);
        }
    }

    return result;
}

/** Parse YYYYMMDD or ISO expiry in UTC. Missing/invalid expiry sorts last. */
export function expiryTimestamp(
    expiry: string | null | undefined
): number {
    if (!expiry) return Number.POSITIVE_INFINITY;

    const raw = String(expiry).trim();

    if (/^\d{8}$/.test(raw)) {
        const year = Number(raw.slice(0, 4));
        const month = Number(raw.slice(4, 6)) - 1;
        const day = Number(raw.slice(6, 8));
        return Date.UTC(year, month, day);
    }

    const parsed = new Date(raw).getTime();
    return Number.isNaN(parsed)
        ? Number.POSITIVE_INFINITY
        : parsed;
}

function isFutureContract(q: MarketQuote): boolean {
    return q.instrument_type?.toLowerCase() === "future";
}

function isOptionContract(q: MarketQuote): boolean {
    return q.instrument_type?.toLowerCase() === "option";
}

function isSpotContract(q: MarketQuote): boolean {
    return q.instrument_type?.toLowerCase() === "spot";
}

function isExpired(q: MarketQuote, now = Date.now()): boolean {
    if (!isFutureContract(q)) return false;

    const expiry = expiryTimestamp(q.expiry);
    return Number.isFinite(expiry) && expiry < now;
}

/**
 * Selects the single dashboard row for a named instrument.
 *
 * Priority:
 * 1. nearest non-expired future contract
 * 2. spot
 * 3. nearest non-expired/nearest-expiry option
 * 4. any remaining candidate
 *
 * This keeps the commodity dashboard on the active/front contract while
 * still allowing currency spot instruments to work normally. All other
 * expiry months for a commodity remain available on the detail screen's
 * contract table — the dashboard intentionally shows only this one.
 */
export function pickOriginalContract(
    candidates: MarketQuote[]
): MarketQuote | undefined {
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0];

    const activeFutures = candidates.filter(
        (q) => isFutureContract(q) && !isExpired(q)
    );

    if (activeFutures.length > 0) {
        return [...activeFutures].sort((a, b) => {
            const expiryDiff =
                expiryTimestamp(a.expiry) -
                expiryTimestamp(b.expiry);

            if (expiryDiff !== 0) return expiryDiff;

            return (
                (a.strike ?? Number.POSITIVE_INFINITY) -
                (b.strike ?? Number.POSITIVE_INFINITY)
            );
        })[0];
    }

    const spots = candidates.filter(isSpotContract);
    if (spots.length > 0) {
        return spots[0];
    }

    const options = candidates.filter(isOptionContract);
    const pool = options.length > 0 ? options : candidates;

    return [...pool].sort((a, b) => {
        const aExpired = isExpired(a);
        const bExpired = isExpired(b);

        if (aExpired !== bExpired) {
            return aExpired ? 1 : -1;
        }

        const expiryDiff =
            expiryTimestamp(a.expiry) -
            expiryTimestamp(b.expiry);

        if (expiryDiff !== 0) return expiryDiff;

        return (
            (a.strike ?? Number.POSITIVE_INFINITY) -
            (b.strike ?? Number.POSITIVE_INFINITY)
        );
    })[0];
}

/**
 * Sorts detail-page contracts so the nearest expiry is first.
 * One quote per contract should already have been selected by deduplicateQuotes.
 */
export function sortContractQuotes(
    quotes: MarketQuote[]
): MarketQuote[] {
    return [...quotes].sort((a, b) => {
        const aType = normalize(a.instrument_type);
        const bType = normalize(b.instrument_type);

        if (aType === "SPOT" && bType !== "SPOT") return -1;
        if (bType === "SPOT" && aType !== "SPOT") return 1;

        const expiryDiff =
            expiryTimestamp(a.expiry) -
            expiryTimestamp(b.expiry);

        if (expiryDiff !== 0) return expiryDiff;

        const strikeDiff =
            (a.strike ?? Number.POSITIVE_INFINITY) -
            (b.strike ?? Number.POSITIVE_INFINITY);

        if (strikeDiff !== 0) return strikeDiff;

        return (
            new Date(b.ticker_time).getTime() -
            new Date(a.ticker_time).getTime()
        );
    });
}

/**
 * Builds the dashboard row list.
 *
 * Exactly ONE row per name in `order` — the nearest active contract
 * (via pickOriginalContract), not every expiry month. All other
 * contracts for that name are reachable from the detail screen, not
 * shown here.
 *
 * Fixed names stay in their configured positions. If one poll
 * temporarily misses a fixed instrument, keep its previous row
 * visible until fresh data returns instead of making the table jump.
 */
export function stableInstrumentOrder(
    previous: MarketQuote[],
    incoming: MarketQuote[],
    order: readonly string[]
): MarketQuote[] {
    const incomingByKey = new Map<string, MarketQuote>();

    for (const quote of incoming) {
        incomingByKey.set(keyOf(quote), quote);
    }

    const result: MarketQuote[] = [];
    const claimedNames = new Set<string>();

    for (const orderName of order) {
        const targetName = normalize(orderName);

        const candidates = incoming.filter(
            (q) => instrumentName(q) === targetName
        );

        const chosen = pickOriginalContract(candidates);

        if (chosen) {
            result.push(chosen);
        } else {
            const previousQuote = previous.find(
                (q) => instrumentName(q) === targetName
            );

            if (previousQuote) {
                result.push(previousQuote);
            }
        }

        claimedNames.add(targetName);
    }

    const previousExtraKeys = previous
        .filter(
            (q) => !claimedNames.has(instrumentName(q))
        )
        .map(keyOf);

    for (const key of previousExtraKeys) {
        const quote = incomingByKey.get(key);

        if (
            quote &&
            !result.some((item) => keyOf(item) === key)
        ) {
            result.push(quote);
        }
    }

    for (const quote of incoming) {
        if (
            !result.some(
                (item) => keyOf(item) === keyOf(quote)
            )
        ) {
            result.push(quote);
        }
    }

    return result;
}

export function latestQuoteTime(
    quotes: MarketQuote[]
): Date | null {
    let latest = Number.NaN;

    for (const quote of quotes) {
        const timestamp = new Date(quote.ticker_time).getTime();

        if (!Number.isNaN(timestamp)) {
            latest = Number.isNaN(latest)
                ? timestamp
                : Math.max(latest, timestamp);
        }
    }

    return Number.isNaN(latest)
        ? null
        : new Date(latest);
}

/** True when all available quotes are older than staleMs. */
export function isStale(
    quotes: MarketQuote[],
    staleMs: number,
    now = Date.now()
): boolean {
    if (quotes.length === 0) return true;

    return quotes.every((q) => {
        const timestamp = new Date(q.ticker_time).getTime();

        return (
            Number.isNaN(timestamp) ||
            now - timestamp > staleMs
        );
    });
}