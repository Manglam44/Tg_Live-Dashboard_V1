import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketQuote } from "@/lib/types";
import { REFRESH_INTERVAL_MS } from "@/lib/dashboard/constants";
import { deduplicateTicks } from "@/lib/dashboard/quotes";

interface InstrumentSelector {
    assetClass: string;
    instrument: string;
    commodityName: string;
    symbol: string;
    mode: string;
    instrumentType: string;
    expiry: string;
    strike: string;
    right: string;
}

interface UseInstrumentQuotesResult {
    quotes: MarketQuote[];
    latestQuote: MarketQuote | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    refresh: () => void;
}

export function useInstrumentQuotes(
    selector: InstrumentSelector
): UseInstrumentQuotesResult {
    const [quotes, setQuotes] = useState<MarketQuote[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const inFlight = useRef(false);
    const controllerRef = useRef<AbortController | null>(null);

    const load = useCallback(
        async (initial = false) => {
            // A poll cannot cancel the previous poll. It waits for the current
            // request to finish, which prevents the detail page from staying
            // permanently in a canceled/loading state.
            if (inFlight.current) return;

            inFlight.current = true;
            const controller = new AbortController();
            controllerRef.current = controller;

            try {
                if (initial) {
                    setLoading(true);
                    setQuotes([]);
                } else {
                    setRefreshing(true);
                }
                setError(null);

                let url: string;

                if (selector.assetClass === "commodity") {
                    const params = new URLSearchParams();
                    params.set("name", selector.commodityName);
                    params.set(
                        "symbol",
                        selector.symbol || selector.instrument
                    );
                    params.set("mode", selector.mode);

                    if (selector.instrumentType) {
                        params.set("instrument_type", selector.instrumentType);
                    }

                    // Keep all expiry contracts. Expiry is filtered/displayed
                    // by the detail UI rather than sent as an API restriction.
                    params.set("limit", "5000");
                    url = `/api/historical/commodity?${params.toString()}`;
                } else {
                    const params = new URLSearchParams({
                        mode: selector.mode,
                        limit: "5000",
                    });
                    url = `/api/market/${selector.assetClass}?${params.toString()}`;
                }

                const response = await fetch(url, {
                    cache: "no-store",
                    signal: controller.signal,
                    headers: { Accept: "application/json" },
                });

                if (!response.ok) {
                    throw new Error(`API returned ${response.status}`);
                }

                const data = (await response.json()) as MarketQuote[];

                if (!Array.isArray(data)) {
                    throw new Error("Invalid instrument data response.");
                }

                const matched = data.filter((quote) => {
                    if (selector.assetClass === "commodity") {
                        const nameMatches =
                            !selector.commodityName ||
                            String(quote.name ?? "").toUpperCase() ===
                                selector.commodityName.toUpperCase();

                        const symbolMatches =
                            !selector.symbol ||
                            String(quote.symbol ?? "").toUpperCase() ===
                                selector.symbol.toUpperCase();

                        const typeMatches =
                            !selector.instrumentType ||
                            quote.instrument_type === selector.instrumentType;

                        return nameMatches && symbolMatches && typeMatches;
                    }

                    const selected = selector.instrument.toUpperCase();
                    const symbol = String(
                        quote.symbol ??
                            quote.pair ??
                            quote.name ??
                            quote.underlying ??
                            ""
                    ).toUpperCase();

                    const symbolMatches =
                        symbol === selected ||
                        String(quote.name ?? "").toUpperCase() === selected ||
                        String(quote.underlying ?? "").toUpperCase() === selected;

                    if (!symbolMatches) return false;
                    if (
                        selector.instrumentType &&
                        quote.instrument_type !== selector.instrumentType
                    ) {
                        return false;
                    }
                    if (
                        selector.strike &&
                        String(quote.strike ?? "") !== selector.strike
                    ) {
                        return false;
                    }
                    if (selector.right && quote.right !== selector.right) {
                        return false;
                    }

                    return true;
                });

                // Only drop exact duplicate ticks (same contract + same
                // timestamp), e.g. from overlapping polls. The full
                // per-contract time series must be preserved here — the
                // chart and history table depend on it. Collapsing to one
                // row per contract (deduplicateQuotes) is a bug for this hook.
                const unique = deduplicateTicks(matched);

                unique.sort(
                    (a, b) =>
                        new Date(b.ticker_time).getTime() -
                        new Date(a.ticker_time).getTime()
                );

                setQuotes(unique);
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }

                console.error("Instrument detail loading failed:", err);
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load instrument data."
                );
            } finally {
                if (controllerRef.current === controller) {
                    controllerRef.current = null;
                }
                inFlight.current = false;
                setLoading(false);
                setRefreshing(false);
            }
        },
        [
            selector.assetClass,
            selector.instrument,
            selector.commodityName,
            selector.symbol,
            selector.mode,
            selector.instrumentType,
            selector.strike,
            selector.right,
        ]
    );

    useEffect(() => {
        void load(true);

        return () => {
            controllerRef.current?.abort();
            controllerRef.current = null;
            inFlight.current = false;
        };
    }, [load]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            void load(false);
        }, REFRESH_INTERVAL_MS);

        return () => window.clearInterval(interval);
    }, [load]);

    return {
        quotes,
        latestQuote: quotes[0] ?? null,
        loading,
        refreshing,
        error,
        refresh: () => void load(false),
    };
}