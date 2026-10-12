"use client";

import TradingChart from "@/components/TradingChart/TradingChart";
import { normalizeCandles, type Candle, type RawRow } from "@/lib/chart-data";
import { useEffect, useState } from "react";

export default function ChartPage() {
    const symbol = "ZM";
    const [interval, setIntervalTf] = useState("1D");
    const [expiry, setExpiry] = useState(null);
    const [data, setData] = useState<Candle[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Load history from YOUR api whenever the timeframe changes
    useEffect(() => {
        let cancelled = false;
        setError(null);
        fetch(`/api/candles?symbol=${symbol}&interval=${interval}${expiry ? `&expiry=${expiry}` : ''}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
            .then((rows: RawRow[]) => !cancelled && setData(normalizeCandles(rows)))
            .catch((e: Error) => !cancelled && setError(e.message));
        return () => {
            cancelled = true;
        };
    }, [symbol, interval, expiry]);

    return (
        <main style={{ padding: 16 }}>
            {error && <p role="alert">Could not load chart data: {error}</p>}
            <TradingChart
                symbol={symbol}
                data={data}
                interval={interval}
                onIntervalChange={setIntervalTf}
                // liveBar={liveBar}
                height={600}
            />
        </main>
    );
}