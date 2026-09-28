import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import type { MarketQuote, Mode } from "@/lib/types";
import {
    deduplicateQuotes,
    isStale,
    latestQuoteTime,
    stableInstrumentOrder,
} from "@/lib/dashboard/quotes";
import {
    FAILURE_THRESHOLD,
    REFRESH_INTERVAL_MS,
    STALE_QUOTE_MS,
} from "@/lib/dashboard/constants";

interface UseMarketQuotesResult {
    quotes: MarketQuote[];
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    updated: Date | null;
    liveDataDown: boolean;
    refresh: () => void;
}

export function useMarketQuotes(
    endpoint: string,
    mode: Mode,
    order: readonly string[]
): UseMarketQuotesResult {
    const [quotes, setQuotes] = useState<MarketQuote[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [updated, setUpdated] = useState<Date | null>(null);
    const [liveDataDown, setLiveDataDown] = useState(false);

    const failureStreak = useRef(0);
    const inFlight = useRef(false);
    const controllerRef = useRef<AbortController | null>(null);

    const load = useCallback(
        async (initial = false) => {
            // Never start another poll while the previous request is still running.
            // This prevents the one-second timer from creating a cancellation loop.
            if (inFlight.current) return;

            inFlight.current = true;
            const controller = new AbortController();
            controllerRef.current = controller;

            try {
                if (initial) {
                    setLoading(true);
                    setError(null);
                    setLiveDataDown(false);
                } else {
                    setRefreshing(true);
                }

                const params = new URLSearchParams({
                    mode,
                    limit: "500",
                });

                const response = await fetch(
                    `${endpoint}?${params.toString()}`,
                    {
                        cache: "no-store",
                        signal: controller.signal,
                        headers: { Accept: "application/json" },
                    }
                );


                if (!response.ok) {
                    throw new Error(`${endpoint} returned ${response.status}`);
                }

                const data = (await response.json()) as MarketQuote[];

                if (!Array.isArray(data)) {
                    throw new Error("Invalid market data response.");
                }

                const unique = deduplicateQuotes(data);
                const stale =
                    mode === "live" && isStale(unique, STALE_QUOTE_MS);

                if (mode === "live" && (unique.length === 0 || stale)) {
                    failureStreak.current += 1;
                } else {
                    failureStreak.current = 0;
                }

                setQuotes((previous) =>
                    stableInstrumentOrder(previous, unique, order)
                );
                setUpdated(latestQuoteTime(unique));
                setError(null);
                setLiveDataDown(
                    mode === "live" &&
                    failureStreak.current >= FAILURE_THRESHOLD
                );
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }

                console.error("Market data loading failed:", err);
                failureStreak.current += 1;
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load market data."
                );
                setLiveDataDown(
                    mode === "live" &&
                    failureStreak.current >= FAILURE_THRESHOLD
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
        [endpoint, mode, order]
    );

    useEffect(() => {
        failureStreak.current = 0;
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
        loading,
        refreshing,
        error,
        updated,
        liveDataDown,
        refresh: () => void load(false),
    };
}
