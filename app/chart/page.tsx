"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import TradingChart from "../../components/TradingChart/TradingChart";
import InstrumentInfo from "../../components/InstrumentInfo/InstrumentInfo";
import { useLiveCandle } from "../../hooks/useLiveCandle";
import { normalizeCandles, type Candle, type Interval, type RawRow } from "../../lib/chart-data";

function ChartContent() {
    // /chart?symbol=GC&expiry=20270127&name=GOLD
    const sp = useSearchParams();
    const symbol = sp.get("symbol") ?? "";
    const name = sp.get("name") ?? symbol;
    const rawExpiry = sp.get("expiry");
    const param = (k: string) => sp.get(k) || null; // empty string -> null
    const expiry = rawExpiry && /^\d{8}$/.test(rawExpiry) ? rawExpiry : null; // API expects YYYYMMDD

    const [interval, setIntervalTf] = useState<Interval>("5m");
    const [contract, setContract] = useState<string | null>(null); // contract the server actually used
    const [data, setData] = useState<Candle[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [theme, setTheme] = useState<"dark" | "light">("dark"); // panel follows the chart theme

    // 1) history
    useEffect(() => {
        if (!symbol) return;
        let cancelled = false;
        setError(null);
        setData([]);

        const params = new URLSearchParams({ symbol, interval });
        if (expiry) params.set("expiry", expiry);

        fetch(`/api/candles?${params}`)
            .then(async (r) => {
                if (!r.ok) {
                    const body = await r.json().catch(() => ({}));
                    throw new Error(body.detail ?? body.error ?? `HTTP ${r.status}`);
                }
                if (!cancelled) setContract(r.headers.get("x-contract-expiry"));
                return r.json();
            })
            .then((rows: RawRow[]) => !cancelled && setData(normalizeCandles(rows)))
            .catch((e: Error) => !cancelled && setError(e.message));

        return () => {
            cancelled = true;
        };
    }, [symbol, interval, expiry]);

    // 2) realtime: same symbol, interval and contract as the history above
    const { liveBar, status } = useLiveCandle({
        symbol,
        interval,
        expiry: expiry ?? contract,
        enabled: data.length > 0,
    });

    if (!symbol) return <p role="alert">No symbol selected. Open a chart from the market list.</p>;

    return (
        <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <InstrumentInfo
                symbol={symbol}
                name={name}
                assetClass={param("asset_class")}
                instrumentType={param("instrument_type")}
                exchange={param("exchange")}
                underlying={param("underlying")}
                expiry={rawExpiry}
                strike={param("strike")}
                right={param("right")}
                mode={param("mode")}
                theme={theme}
            />
            {error && <p role="alert">Could not load chart data: {error}</p>}
            <TradingChart
                symbol={name}
                data={data}
                interval={interval}
                onIntervalChange={setIntervalTf}
                liveBar={liveBar}
                liveStatus={status}
                onThemeChange={setTheme}
                height={600}
            />
        </main>
    );
}

// useSearchParams must sit under a Suspense boundary, or `next build` fails.
export default function ChartPage() {
    return (
        <Suspense fallback={<p style={{ padding: 16 }}>Loading chart…</p>}>
            <ChartContent />
        </Suspense>
    );
}