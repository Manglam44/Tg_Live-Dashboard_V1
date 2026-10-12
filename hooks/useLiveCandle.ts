"use client";

import { useEffect, useState } from "react";
import { normalizeCandles, type Candle, type Interval } from "../lib/chart-data";

export type LiveStatus = "off" | "connecting" | "live" | "reconnecting";

/** Subscribes to /api/stream and returns the newest (forming) candle. */
export function useLiveCandle(opts: {
    symbol: string;
    interval: Interval;
    expiry: string | null; // use the SAME contract as the history request
    enabled?: boolean;
}) {
    const { symbol, interval, expiry, enabled = true } = opts;
    const [liveBar, setLiveBar] = useState<Candle | null>(null);
    const [status, setStatus] = useState<LiveStatus>("off");

    useEffect(() => {
        setLiveBar(null);
        if (!enabled || !expiry) {
            setStatus("off");
            return;
        }
        setStatus("connecting");
        const params = new URLSearchParams({ symbol, interval, expiry });
        const es = new EventSource(`/api/stream?${params}`); // auto-reconnects on drop

        es.onopen = () => setStatus("live");
        es.onerror = () => setStatus("reconnecting");
        es.onmessage = (e) => {
            try {
                const [c] = normalizeCandles([JSON.parse(e.data)]);
                if (c) setLiveBar(c);
            } catch {
                /* ignore malformed message */
            }
        };
        return () => es.close();
    }, [symbol, interval, expiry, enabled]);

    return { liveBar, status };
}