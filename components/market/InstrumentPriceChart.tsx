"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import * as echarts from "echarts";

interface ChartQuote {
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
}

interface ChartResponse {
    asset_group: string;
    mode: string;
    symbol: string;
    expiry: string;
    order: string;
    count: number;
    data: ChartQuote[];
}

type ChartRange = "1D" | "1D_5M";

interface ChartPoint {
    time: number;
    price: number;
}

interface Props {
    symbol: string;
    expiry: string | null;
    mode?: string;
    commodityName?: string;
}

const REFRESH_INTERVAL = 10_000;

export default function InstrumentPriceChart({
    symbol,
    expiry,
    mode = "live",
    commodityName,
}: Props) {


    const chartContainerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<echarts.ECharts | null>(null);

    const [range, setRange] = useState<ChartRange>("1D");
    const [chartData, setChartData] = useState<ChartQuote[]>([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);


    const fetchChartData = useCallback(
        async (isRefresh = false) => {
            if (!symbol || !expiry) {
                setChartData([]);
                setLoading(false);
                return;
            }

            try {
                if (isRefresh) {
                    setRefreshing(true);
                } else {
                    setLoading(true);
                }

                setError(null);

                const params = new URLSearchParams({
                    asset_group: "commodity",
                    symbol,
                    expiry,
                    mode,
                    order: "asc",
                    limit: "10000",
                });

                const response = await fetch(`/api/market/chart?${params.toString()}`,
                    {
                        method: "GET",
                        cache: "no-store",
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch chart data (${response.status})`
                    );
                }

                const result: ChartResponse =
                    await response.json();

                setChartData(result.data || []);
            } catch (err) {
                console.error("Chart API error:", err);

                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load chart data."
                );
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [symbol, expiry, mode]
    );


    useEffect(() => {
        fetchChartData();

        if (mode.toLowerCase() !== "live") {
            return;
        }

        const interval = window.setInterval(() => {
            fetchChartData(true);
        }, REFRESH_INTERVAL);

        return () => {
            window.clearInterval(interval);
        };
    }, [fetchChartData, mode]);


    const oneDayData = useMemo<ChartPoint[]>(() => {
        if (!chartData.length) {
            return [];
        }

        const validData = chartData
            .filter(
                (item) =>
                    item.last !== null &&
                    item.last !== undefined &&
                    item.quote_time
            )
            .map((item) => ({
                time: new Date(item.quote_time).getTime(),
                price: Number(item.last),
            }))
            .filter(
                (item) =>
                    Number.isFinite(item.time) &&
                    Number.isFinite(item.price)
            )
            .sort((a, b) => a.time - b.time);

        if (!validData.length) {
            return [];
        }

        /*
         * Use the latest quote returned by the API as the
         * reference point rather than browser "now".
         *
         * This is important if the API is delayed.
         */
        const latestTime =
            validData[validData.length - 1].time;

        const oneDayAgo =
            latestTime - 24 * 60 * 60 * 1000;

        return validData.filter(
            (point) => point.time >= oneDayAgo
        );
    }, [chartData]);


    const fiveMinuteData = useMemo<ChartPoint[]>(() => {
        if (!oneDayData.length) {
            return [];
        }

        const buckets = new Map<number, ChartPoint>();

        const FIVE_MINUTES = 5 * 60 * 1000;

        for (const point of oneDayData) {
            const bucketTime =
                Math.floor(point.time / FIVE_MINUTES) *
                FIVE_MINUTES;

            buckets.set(bucketTime, {
                time: bucketTime,
                price: point.price,
            });
        }

        return Array.from(buckets.values()).sort(
            (a, b) => a.time - b.time
        );
    }, [oneDayData]);

    const displayData = useMemo(() => {
        return range === "1D"
            ? oneDayData
            : fiveMinuteData;
    }, [range, oneDayData, fiveMinuteData]);

    const latestPrice = useMemo(() => {
        if (!displayData.length) {
            return null;
        }

        return displayData[displayData.length - 1].price;
    }, [displayData]);

    /*
     * ---------------------------------------------------------
     * Price change
     * ---------------------------------------------------------
     */

    const priceChange = useMemo(() => {
        if (displayData.length < 2) {
            return null;
        }

        const first = displayData[0].price;
        const last =
            displayData[displayData.length - 1].price;

        const change = last - first;

        const changePercent =
            first !== 0
                ? (change / first) * 100
                : 0;

        return {
            change,
            changePercent,
        };
    }, [displayData]);

    /*
     * ---------------------------------------------------------
     * Create / update ECharts
     * ---------------------------------------------------------
     */

    useEffect(() => {
        if (!chartContainerRef.current) {
            return;
        }

        if (!chartRef.current) {
            chartRef.current = echarts.init(
                chartContainerRef.current
            );
        }

        const chart = chartRef.current;

        const timestamps = displayData.map(
            (point) => point.time
        );

        const prices = displayData.map(
            (point) => [point.time, point.price]
        );

        const option: echarts.EChartsOption = {
            animation: false,

            grid: {
                top: 30,
                right: 70,
                bottom: 70,
                left: 65,
            },

            tooltip: {
                trigger: "axis",

                axisPointer: {
                    type: "cross",
                    snap: false,
                    label: {
                        show: true,
                    },
                },

                backgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                borderWidth: 1,

                textStyle: {
                    color: "#111827",
                },

                formatter: (params: any) => {
                    if (!params?.length) {
                        return "";
                    }

                    const point = params[0];

                    const timestamp = point.value?.[0];
                    const price = point.value?.[1];

                    const date = new Date(timestamp);

                    return `
                        <div style="min-width:150px">
                            <div style="font-size:11px;color:#6b7280;margin-bottom:5px">
                                ${date.toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                    })}
                            </div>

                            <div style="font-size:14px;font-weight:600;color:#111827">
                                ${Number(price).toLocaleString(
                        "en-US",
                        {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                        }
                    )}
                            </div>
                        </div>
                    `;
                },
            },

            xAxis: {
                type: "time",

                boundaryGap: false,

                axisLine: {
                    lineStyle: {
                        color: "#e5e7eb",
                    },
                },

                axisTick: {
                    show: false,
                },

                axisLabel: {
                    color: "#6b7280",
                    fontSize: 11,
                },

                splitLine: {
                    show: true,
                    lineStyle: {
                        color: "#f3f4f6",
                    },
                },
            },

            yAxis: {
                type: "value",

                scale: true,

                position: "right",

                axisLine: {
                    show: false,
                },

                axisTick: {
                    show: false,
                },

                axisLabel: {
                    color: "#6b7280",
                    fontSize: 11,

                    formatter: (value: number) =>
                        value.toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                        }),
                },

                splitLine: {
                    show: true,

                    lineStyle: {
                        color: "#f3f4f6",
                    },
                },
            },

            series: [
                {
                    name: `${symbol} Price`,

                    type: "line",

                    data: prices,

                    smooth: false,

                    showSymbol: false,

                    symbol: "circle",

                    symbolSize: 5,

                    lineStyle: {
                        width: 1.5,
                    },

                    emphasis: {
                        focus: "series",

                        itemStyle: {
                            borderWidth: 2,
                        },
                    },

                    areaStyle: {
                        opacity: 0.04,
                    },
                },
            ],

            dataZoom: [
                {
                    type: "inside",

                    xAxisIndex: 0,

                    filterMode: "none",

                    zoomOnMouseWheel: true,

                    moveOnMouseMove: true,

                    moveOnMouseWheel: true,
                },

                {
                    type: "slider",

                    xAxisIndex: 0,

                    height: 24,

                    bottom: 15,

                    borderColor: "#e5e7eb",

                    backgroundColor: "#f9fafb",

                    fillerColor: "rgba(59,130,246,0.08)",

                    handleStyle: {
                        borderWidth: 1,
                    },

                    textStyle: {
                        color: "#6b7280",
                        fontSize: 10,
                    },
                },
            ],
        };

        chart.setOption(option, true);

        /*
         * Automatically show the latest portion of the chart.
         */
        if (timestamps.length > 0) {
            chart.dispatchAction({
                type: "dataZoom",
                start: 0,
                end: 100,
            });
        }

        const handleResize = () => {
            chart.resize();
        };

        window.addEventListener(
            "resize",
            handleResize
        );

        return () => {
            window.removeEventListener(
                "resize",
                handleResize
            );
        };
    }, [displayData, symbol]);

    /*
     * ---------------------------------------------------------
     * Cleanup ECharts
     * ---------------------------------------------------------
     */

    useEffect(() => {
        return () => {
            if (chartRef.current) {
                chartRef.current.dispose();
                chartRef.current = null;
            }
        };
    }, []);

    /*
     * ---------------------------------------------------------
     * Reset zoom
     * ---------------------------------------------------------
     */

    const resetZoom = () => {
        chartRef.current?.dispatchAction({
            type: "dataZoom",
            start: 0,
            end: 100,
        });
    };

    /*
     * ---------------------------------------------------------
     * UI
     * ---------------------------------------------------------
     */

    return (
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">

            {/* Header */}
            <div className="border-b border-gray-200 p-5">

                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            {/* <h2 className="text-lg font-semibold text-gray-900">
                                Price Chart
                            </h2> */}

                            {/* <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                                {symbol}
                            </span> */}

                            {expiry && (
                                <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                                    {formatExpiry(expiry)}
                                </span>
                            )}

                            {mode.toLowerCase() ===
                                "live" && (
                                    <span className="flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                                        LIVE
                                    </span>
                                )}
                        </div>

                        <p className="mt-1 text-xs text-gray-500">
                            {commodityName ||
                                symbol}{" "}
                            price movement
                        </p>
                    </div>

                    {/* Latest price */}
                    <div className="flex items-center gap-5">

                        <div>
                            <p className="text-xs text-gray-500">
                                Last
                            </p>

                            <p className="text-xl font-bold text-gray-900">
                                {latestPrice !== null
                                    ? latestPrice.toLocaleString(
                                        "en-US",
                                        {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 4,
                                        }
                                    )
                                    : "-"}
                            </p>
                        </div>

                        {priceChange && (
                            <div>
                                <p className="text-xs text-gray-500">
                                    Change
                                </p>

                                <p
                                    className={`text-sm font-semibold ${priceChange.change >
                                        0
                                        ? "text-green-600"
                                        : priceChange.change <
                                            0
                                            ? "text-red-600"
                                            : "text-gray-600"
                                        }`}
                                >
                                    {priceChange.change >
                                        0
                                        ? "+"
                                        : ""}
                                    {priceChange.change.toFixed(
                                        2
                                    )}{" "}
                                    (
                                    {priceChange.changePercent >
                                        0
                                        ? "+"
                                        : ""}
                                    {priceChange.changePercent.toFixed(
                                        2
                                    )}
                                    %)
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">

                {/* Range */}
                <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">

                    <ChartButton
                        active={range === "1D"}
                        onClick={() =>
                            setRange("1D")
                        }
                    >
                        1 Day
                    </ChartButton>

                    <ChartButton
                        active={range === "1D_5M"}
                        onClick={() =>
                            setRange("1D_5M")
                        }
                    >
                        1 Day · 5 Min
                    </ChartButton>
                </div>

                {/* Tools */}
                <div className="flex items-center gap-2">

                    <span className="hidden text-xs text-gray-400 sm:inline">
                        {displayData.length.toLocaleString()}{" "}
                        points
                    </span>

                    <button
                        type="button"
                        onClick={resetZoom}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                    >
                        Reset Zoom
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            fetchChartData(true)
                        }
                        disabled={refreshing}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {refreshing
                            ? "Updating..."
                            : "Refresh"}
                    </button>
                </div>
            </div>

            {/* Chart */}
            <div className="relative">

                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                            Loading chart...
                        </div>
                    </div>
                )}

                {error && (
                    <div className="flex min-h-[420px] items-center justify-center p-6">
                        <div className="text-center">
                            <p className="text-sm font-medium text-red-600">
                                {error}
                            </p>

                            <button
                                type="button"
                                onClick={() =>
                                    fetchChartData()
                                }
                                className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                {!error && !loading && !displayData.length && (
                    <div className="flex min-h-[420px] items-center justify-center">
                        <p className="text-sm text-gray-500">
                            No chart data available for this
                            contract.
                        </p>
                    </div>
                )}

                {!error && displayData.length > 0 && (
                    <div
                        ref={chartContainerRef}
                        className="h-[460px] w-full"
                    />
                )}
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-1 border-t border-gray-100 px-5 py-3 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">

                <span>
                    {range === "1D"
                        ? "Tick data · Last 24 hours"
                        : "5-minute aggregated data · Last 24 hours"}
                </span>

                <span>
                    {refreshing
                        ? "Updating market data..."
                        : mode.toLowerCase() ===
                            "live"
                            ? "Auto refresh: 10 seconds"
                            : "Historical data"}
                </span>
            </div>
        </section>
    );
}

/*
 * ---------------------------------------------------------
 * Chart button
 * ---------------------------------------------------------
 */

function ChartButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${active
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
                }`}
        >
            {children}
        </button>
    );
}

/*
 * ---------------------------------------------------------
 * Expiry formatter
 * ---------------------------------------------------------
 */

function formatExpiry(expiry: string) {
    if (!expiry || expiry.length !== 8) {
        return expiry || "-";
    }

    const date = new Date(
        Number(expiry.slice(0, 4)),
        Number(expiry.slice(4, 6)) - 1,
        Number(expiry.slice(6, 8))
    );

    return date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}