"use client";

import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

export type MarketTick = {
    quote_time: string;
    ticker_time: string;
    ticker_time_zone: string;
    mode: string;
    asset_class: string;
    instrument_type: string;
    name: string;
    symbol: string;
    pair: string | null;
    exchange: string;
    expiry: string;
    strike: number | null;
    right: string | null;
    underlying: string;
    bid: number | null;
    ask: number | null;
    last: number | null;
    bid_size: number | null;
    ask_size: number | null;
    last_size: number | null;
};

type Candle = {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    tickCount: number;
};

type ChartType = "intraday" | "line" | "candlestick";
type Period = "1D" | "1W";

type AxisBreak = { start: number; end: number; gap: number };

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_WEEK = 7 * ONE_DAY;

function aggregateTo5Minutes(ticks: MarketTick[]): Candle[] {
    if (!ticks?.length) return [];

    const validTicks = ticks
        .filter(
            (tick) =>
                tick.last !== null &&
                tick.last !== undefined &&
                Number.isFinite(Number(tick.last))
        )
        .sort(
            (a, b) =>
                new Date(a.ticker_time).getTime() -
                new Date(b.ticker_time).getTime()
        );

    const buckets = new Map<number, MarketTick[]>();

    for (const tick of validTicks) {
        const timestamp = new Date(tick.ticker_time).getTime();
        if (!Number.isFinite(timestamp)) continue;

        const bucketTime = Math.floor(timestamp / FIVE_MINUTES) * FIVE_MINUTES;
        const existing = buckets.get(bucketTime);

        if (existing) existing.push(tick);
        else buckets.set(bucketTime, [tick]);
    }

    return Array.from(buckets.entries())
        .sort(([a], [b]) => a - b)
        .map(([timestamp, bucket]) => {
            const prices = bucket
                .map((tick) => Number(tick.last))
                .filter(Number.isFinite);

            if (!prices.length) return null;

            const volume = bucket.reduce(
                (total, tick) => total + Number(tick.last_size ?? 0),
                0
            );

            return {
                timestamp,
                open: prices[0],
                high: Math.max(...prices),
                low: Math.min(...prices),
                close: prices[prices.length - 1],
                volume,
                tickCount: bucket.length,
            };
        })
        .filter((item): item is Candle => item !== null);
}

function detectBreaks(candles: Candle[], minGapMs: number): AxisBreak[] {
    const breaks: AxisBreak[] = [];

    for (let i = 1; i < candles.length; i++) {
        const prev = candles[i - 1].timestamp;
        const next = candles[i].timestamp;

        if (next - prev > minGapMs) {
            breaks.push({ start: prev, end: next, gap: 0 });
        }
    }

    return breaks;
}

function getStartTime(period: Period): number {
    const now = Date.now();
    return period === "1D" ? now - ONE_DAY : now - ONE_WEEK;
}

function formatPrice(value: number): string {
    return value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    });
}

function formatDateTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

interface CommodityPriceChartProps {
    ticks: MarketTick[];
    expiry?: string;
    height?: number;
    commodityName?: string;
    symbol?: string;
    defaultPeriod?: Period;
    defaultChartType?: ChartType;
    breakGapMinutes?: number;
    showControls?: boolean;
}

export default function CommodityPriceChart({
    ticks,
    expiry,
    height = 500,
    commodityName = "Commodity",
    symbol,
    defaultPeriod = "1D",
    defaultChartType = "intraday",
    breakGapMinutes = 30,
    showControls = true,
}: CommodityPriceChartProps) {
    const [period, setPeriod] = useState<Period>(defaultPeriod);
    const [chartType, setChartType] = useState<ChartType>(defaultChartType);

    /* ---------------- Filter ticks ---------------- */

    const filteredTicks = useMemo(() => {
        if (!ticks?.length) return [];

        return ticks.filter((tick) => {
            if (
                commodityName &&
                tick.name &&
                tick.name.toUpperCase() !== commodityName.toUpperCase()
            ) {
                return false;
            }

            if (
                symbol &&
                tick.symbol &&
                tick.symbol.toUpperCase() !== symbol.toUpperCase()
            ) {
                return false;
            }

            if (expiry && tick.expiry !== expiry) return false;

            return true;
        });
    }, [ticks, expiry, commodityName, symbol]);

    /* ---------------- 5-minute candles ---------------- */

    const candles = useMemo(
        () => aggregateTo5Minutes(filteredTicks),
        [filteredTicks]
    );

    /* ---------------- Selected period ---------------- */

    const periodCandles = useMemo(() => {
        if (!candles.length) return [];
        const startTime = getStartTime(period);
        return candles.filter((candle) => candle.timestamp >= startTime);
    }, [candles, period]);

    /* ---------------- Axis breaks (Intraday) ---------------- */

    const axisBreaks = useMemo(
        () => detectBreaks(periodCandles, breakGapMinutes * 60 * 1000),
        [periodCandles, breakGapMinutes]
    );

    /* ---------------- Current / previous price ---------------- */

    const latestCandle = periodCandles[periodCandles.length - 1];
    const previousCandle = periodCandles[periodCandles.length - 2];

    const currentPrice = latestCandle?.close ?? null;
    const previousPrice = previousCandle?.close ?? null;

    const priceChange =
        currentPrice !== null && previousPrice !== null
            ? currentPrice - previousPrice
            : 0;

    const priceChangePercent =
        currentPrice !== null && previousPrice !== null && previousPrice !== 0
            ? (priceChange / previousPrice) * 100
            : 0;

    /* ---------------- ECharts option ---------------- */

    const option = useMemo<EChartsOption>(() => {
        const isIntraday = chartType === "intraday";

        // [time, open, close, low, high] -- time axis needs the timestamp
        const candlestickData = periodCandles.map((candle) => [
            candle.timestamp,
            candle.open,
            candle.close,
            candle.low,
            candle.high,
        ]);

        const lineData = periodCandles.map((candle) => [
            candle.timestamp,
            candle.close,
        ]);

        // Axis breaks need ECharts >= 6, typed loosely for safety.
        const xAxis: any = {
            type: "time",
            boundaryGap: false,

            axisLabel: {
                hideOverlap: true,
                showMinLabel: true,
                showMaxLabel: true,

                formatter: (value: number, _index: number, extra?: any) => {
                    // Label for a collapsed break (only drawn at break start)
                    if (extra?.break) {
                        if (extra.break.type !== "start") return "";

                        return period === "1D"
                            ? `${echarts.time.format(extra.break.start, "{HH}:{mm}", false)}/${echarts.time.format(extra.break.end, "{HH}:{mm}", false)}`
                            : echarts.time.format(extra.break.end, "{dd} {MMM}", false);
                    }

                    return period === "1D"
                        ? echarts.time.format(value, "{HH}:{mm}", false)
                        : echarts.time.format(value, "{dd} {MMM}", false);
                },
            },

            axisPointer: {
                label: {
                    formatter: (params: any) => formatDateTime(params.value),
                },
            },
        };

        if (isIntraday) {
            if (period === "1D") {
                xAxis.interval = 30 * 60 * 1000;
            }

            xAxis.breaks = axisBreaks;

            // Don't auto-move overlapping break labels; formatter controls them.
            xAxis.breakLabelLayout = { moveOverlap: false };

            xAxis.breakArea = {
                expandOnClick: false,
                zigzagAmplitude: 0,
                zigzagZ: 200,
            };
        }

        const baseOption: EChartsOption = {
            animation: false,

            grid: {
                left: 60,
                right: 30,
                top: 30,
                bottom: 90,
            },

            tooltip: {
                trigger: "axis",
                axisPointer: { type: "cross" },
                backgroundColor: "rgba(20, 20, 20, 0.95)",
                borderWidth: 0,
                textStyle: { color: "#fff" },

                formatter: (params: any) => {
                    if (!params?.length) return "";

                    const candle = periodCandles[params[0].dataIndex];
                    if (!candle) return "";

                    return `
            <div style="min-width:180px">
              <div style="font-weight:600;margin-bottom:8px">
                ${formatDateTime(candle.timestamp)}
              </div>
              <div>Open: <strong>${formatPrice(candle.open)}</strong></div>
              <div>High: <strong>${formatPrice(candle.high)}</strong></div>
              <div>Low: <strong>${formatPrice(candle.low)}</strong></div>
              <div>Close: <strong>${formatPrice(candle.close)}</strong></div>
              <div>Ticks: <strong>${candle.tickCount}</strong></div>
              <div>Volume: <strong>${candle.volume}</strong></div>
            </div>
          `;
                },
            },

            xAxis,

            yAxis: {
                type: "value",
                scale: true,
                ...(isIntraday ? { min: "dataMin" as const } : {}),
                axisLabel: {
                    formatter: (value: number) => value.toLocaleString("en-US"),
                },
                splitLine: { lineStyle: { type: "dashed" } },
            },

            dataZoom: [
                {
                    type: "inside",
                    xAxisIndex: 0,
                    zoomOnMouseWheel: true,
                    moveOnMouseMove: true,
                    moveOnMouseWheel: true,
                },
                {
                    type: "slider",
                    xAxisIndex: 0,
                    bottom: 25,
                    height: 20,
                },
            ],

            series: [],
        };

        /* ---- Intraday: plain line, no area, like the reference ---- */
        if (chartType === "intraday") {
            baseOption.series = [
                {
                    name: commodityName,
                    type: "line",
                    data: lineData,
                    symbolSize: 0,
                    showSymbol: false,
                    lineStyle: { width: 2 },
                },
            ];
        }

        /* ---- Line ---- */
        if (chartType === "line") {
            baseOption.series = [
                {
                    name: commodityName,
                    type: "line",
                    data: lineData,
                    smooth: true,
                    showSymbol: false,
                    sampling: "lttb",
                    lineStyle: { width: 2 },
                    areaStyle: { opacity: 0.08 },
                },
            ];
        }

        /* ---- Candlestick ---- */
        if (chartType === "candlestick") {
            baseOption.series = [
                {
                    name: commodityName,
                    type: "candlestick",
                    data: candlestickData,
                    itemStyle: {
                        color: "#16a34a",
                        color0: "#dc2626",
                        borderColor: "#16a34a",
                        borderColor0: "#dc2626",
                    },
                    emphasis: { itemStyle: { borderWidth: 2 } },
                },
            ];
        }

        return baseOption;
    }, [periodCandles, axisBreaks, period, chartType, commodityName]);

    /* ---------------- Empty state ---------------- */

    if (!ticks?.length) {
        return (
            <div
                className="flex items-center justify-center rounded-lg border bg-muted/20"
                style={{ height }}
            >
                <p className="text-sm text-muted-foreground">
                    No price history available.
                </p>
            </div>
        );
    }

    /* ---------------- Render ---------------- */

    const chartTypeButtons: { value: ChartType; label: string }[] = [
        { value: "intraday", label: "Intraday" },
        { value: "line", label: "Line" },
        { value: "candlestick", label: "Candle" },
    ];

    return (
        <div className="w-full rounded-xl border bg-background">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{commodityName}</h3>

                        {symbol && (
                            <span className="text-xs text-muted-foreground">
                                {symbol}
                            </span>
                        )}

                        {expiry && (
                            <span className="rounded-md bg-muted px-2 py-1 text-xs">
                                {expiry}
                            </span>
                        )}
                    </div>

                    {currentPrice !== null && (
                        <div className="mt-1 flex items-center gap-2">
                            <span className="text-xl font-semibold">
                                {formatPrice(currentPrice)}
                            </span>

                            <span
                                className={
                                    priceChange > 0
                                        ? "text-sm text-green-600"
                                        : priceChange < 0
                                            ? "text-sm text-red-600"
                                            : "text-sm text-muted-foreground"
                                }
                            >
                                {priceChange > 0 ? "+" : ""}
                                {formatPrice(priceChange)}
                                {" ("}
                                {priceChangePercent > 0 ? "+" : ""}
                                {priceChangePercent.toFixed(2)}
                                {"%)"}
                            </span>
                        </div>
                    )}
                </div>

                {showControls && (
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Period */}
                        <div className="flex rounded-lg border p-1">
                            {(["1D", "1W"] as const).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setPeriod(item)}
                                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${period === item
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted"
                                        }`}
                                >
                                    {item === "1D" ? "Day" : "Week"}
                                </button>
                            ))}
                        </div>

                        {/* Chart type */}
                        <div className="flex rounded-lg border p-1">
                            {chartTypeButtons.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setChartType(item.value)}
                                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${chartType === item.value
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted"
                                        }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Chart */}
            <div className="w-full">
                {periodCandles.length === 0 ? (
                    <div
                        className="flex items-center justify-center"
                        style={{ height }}
                    >
                        <p className="text-sm text-muted-foreground">
                            No price data available for this period.
                        </p>
                    </div>
                ) : (
                    <ReactECharts
                        option={option}
                        style={{ width: "100%", height }}
                        opts={{ renderer: "canvas" }}
                        notMerge={true}
                        lazyUpdate={true}
                    />
                )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
                <span>5-minute intervals</span>
                <span>{periodCandles.length.toLocaleString()} candles</span>
                <span>{filteredTicks.length.toLocaleString()} ticks</span>
            </div>
        </div>
    );
}