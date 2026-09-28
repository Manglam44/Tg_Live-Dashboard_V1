"use client";

import { useMemo, useState } from "react";
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type { MarketQuote } from "@/lib/types";
import { cx, theme } from "@/lib/dashboard/theme";
import { formatNumber } from "@/lib/dashboard/format";

type Series = "bid" | "ask" | "last";

type TimeRange = "5m" | "1d" | "1w" | "1mo";

const SERIES_CONFIG: Record<
    Series,
    { label: string; color: string }
> = {
    bid: {
        label: "Bid",
        color: theme.down,
    },
    ask: {
        label: "Ask",
        color: theme.up,
    },
    last: {
        label: "Last",
        color: theme.accent,
    },
};

const TIME_RANGE_CONFIG: Record<
    TimeRange,
    { label: string; milliseconds: number }
> = {
    "5m": {
        label: "5 Min",
        milliseconds: 5 * 60 * 1000,
    },
    "1d": {
        label: "1 Day",
        milliseconds: 24 * 60 * 60 * 1000,
    },
    "1w": {
        label: "1 Week",
        milliseconds: 7 * 24 * 60 * 60 * 1000,
    },
    "1mo": {
        label: "1 Month",
        milliseconds: 30 * 24 * 60 * 60 * 1000,
    },
};

interface PriceHistoryChartProps {
    /**
     * Quotes for the currently selected expiry contract.
     * Newest first.
     */
    quotes: MarketQuote[];

    decimals: number;
}

export function PriceHistoryChart({
    quotes,
    decimals,
}: PriceHistoryChartProps) {
    const [active, setActive] = useState<Record<Series, boolean>>({
        bid: true,
        ask: true,
        last: true,
    });

    const [timeRange, setTimeRange] =
        useState<TimeRange>("1d");

    /*
     * ------------------------------------------------------------
     * FILTER QUOTES BY TIME RANGE
     * ------------------------------------------------------------
     *
     * quotes are expected to be newest-first.
     *
     * We use the newest quote as the reference point instead of
     * Date.now(), so delayed/historical data also works correctly.
     */

    const filteredQuotes = useMemo(() => {
        if (quotes.length === 0) {
            return [];
        }

        const newestTimestamp = new Date(
            quotes[0].ticker_time
        ).getTime();

        if (Number.isNaN(newestTimestamp)) {
            return [];
        }

        const range =
            TIME_RANGE_CONFIG[timeRange].milliseconds;

        const startTimestamp =
            newestTimestamp - range;

        return quotes
            .filter((quote) => {
                const timestamp = new Date(
                    quote.ticker_time
                ).getTime();

                return (
                    !Number.isNaN(timestamp) &&
                    timestamp >= startTimestamp &&
                    timestamp <= newestTimestamp
                );
            })
            .slice()
            .sort(
                (a, b) =>
                    new Date(a.ticker_time).getTime() -
                    new Date(b.ticker_time).getTime()
            );
    }, [quotes, timeRange]);

    /*
     * ------------------------------------------------------------
     * CHART DATA
     * ------------------------------------------------------------
     */

    const data = useMemo(() => {
        return filteredQuotes.map((quote) => ({
            time: new Date(quote.ticker_time).getTime(),
            bid: quote.bid,
            ask: quote.ask,
            last: quote.last,
        }));
    }, [filteredQuotes]);

    /*
     * ------------------------------------------------------------
     * SERIES TOGGLE
     * ------------------------------------------------------------
     */

    const toggle = (series: Series) => {
        setActive((prev) => {
            const next = {
                ...prev,
                [series]: !prev[series],
            };

            // Keep at least one series visible.
            if (!next.bid && !next.ask && !next.last) {
                return prev;
            }

            return next;
        });
    };

    const hasData = data.length > 1;

    /*
     * ------------------------------------------------------------
     * LABEL
     * ------------------------------------------------------------
     */

    const rangeLabel =
        TIME_RANGE_CONFIG[timeRange].label;

    return (
        <div
            className={`rounded-md border ${cx.border} ${cx.bgPanel} p-4`}
        >
            {/* HEADER */}
            <div className="mb-4 flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-white">
                            Price History
                        </h2>

                        <p
                            className={`mt-1 text-xs ${cx.textFaint}`}
                        >
                            {hasData
                                ? `${rangeLabel} • ${data.length} data points`
                                : `No data available for ${rangeLabel}`}
                        </p>
                    </div>

                    {/* SERIES FILTER */}
                    <div className="flex items-center gap-1.5">
                        {(
                            Object.keys(
                                SERIES_CONFIG
                            ) as Series[]
                        ).map((series) => {
                            const {
                                label,
                                color,
                            } =
                                SERIES_CONFIG[
                                series
                                ];

                            const isActive =
                                active[series];

                            return (
                                <button
                                    key={series}
                                    type="button"
                                    onClick={() =>
                                        toggle(series)
                                    }
                                    className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition ${isActive
                                            ? `${cx.bgPanelSoft} text-white`
                                            : `${cx.textFaint} hover:text-slate-300`
                                        }`}
                                    style={
                                        isActive
                                            ? {
                                                boxShadow: `inset 0 0 0 1px ${color}55`,
                                            }
                                            : undefined
                                    }
                                >
                                    <span
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{
                                            backgroundColor:
                                                isActive
                                                    ? color
                                                    : theme.textFaint,
                                        }}
                                    />

                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* TIME RANGE FILTER */}
                <div
                    className={`inline-flex w-fit rounded-md border ${cx.border} ${cx.bgPanelSoft} p-1`}
                >
                    {(
                        Object.keys(
                            TIME_RANGE_CONFIG
                        ) as TimeRange[]
                    ).map((range) => {
                        const isActive =
                            timeRange === range;

                        return (
                            <button
                                key={range}
                                type="button"
                                onClick={() =>
                                    setTimeRange(range)
                                }
                                className={`rounded px-3 py-1.5 text-xs font-medium transition ${isActive
                                        ? "bg-white/[0.08] text-white"
                                        : `${cx.textFaint} hover:text-slate-300`
                                    }`}
                            >
                                {
                                    TIME_RANGE_CONFIG[
                                        range
                                    ].label
                                }
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* CHART */}
            {hasData ? (
                <div className="h-[280px] w-full">
                    <ResponsiveContainer
                        width="100%"
                        height="100%"
                    >
                        <LineChart
                            data={data}
                            margin={{
                                top: 4,
                                right: 12,
                                bottom: 0,
                                left: 0,
                            }}
                        >
                            <CartesianGrid
                                stroke={
                                    theme.borderSoft
                                }
                                strokeDasharray="3 3"
                                vertical={false}
                            />

                            <XAxis
                                dataKey="time"
                                type="number"
                                domain={[
                                    "dataMin",
                                    "dataMax",
                                ]}
                                tickFormatter={(t) =>
                                    new Date(
                                        t
                                    ).toLocaleTimeString(
                                        [],
                                        {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            second: "2-digit",
                                        }
                                    )
                                }
                                stroke={
                                    theme.textFaint
                                }
                                tick={{
                                    fill: theme.textFaint,
                                    fontSize: 11,
                                }}
                                minTickGap={40}
                            />

                            <YAxis
                                domain={[
                                    "auto",
                                    "auto",
                                ]}
                                tickFormatter={(v) =>
                                    formatNumber(
                                        v,
                                        decimals
                                    )
                                }
                                stroke={
                                    theme.textFaint
                                }
                                tick={{
                                    fill: theme.textFaint,
                                    fontSize: 11,
                                }}
                                width={70}
                            />

                            <Tooltip
                                contentStyle={{
                                    background:
                                        theme.bgPanelSoft,
                                    border: `1px solid ${theme.border}`,
                                    borderRadius: 6,
                                    fontSize: 12,
                                }}
                                labelFormatter={(t) =>
                                    new Date(
                                        t as number
                                    ).toLocaleString()
                                }
                                formatter={(
                                    value,
                                    name
                                ) => [
                                        formatNumber(
                                            typeof value ===
                                                "number"
                                                ? value
                                                : Number(
                                                    value
                                                ),
                                            decimals
                                        ),
                                        SERIES_CONFIG[
                                            name as Series
                                        ]?.label ??
                                        String(name),
                                    ]}
                            />

                            {active.bid && (
                                <Line
                                    type="monotone"
                                    dataKey="bid"
                                    stroke={
                                        SERIES_CONFIG.bid
                                            .color
                                    }
                                    dot={false}
                                    strokeWidth={1.5}
                                    isAnimationActive={
                                        false
                                    }
                                />
                            )}

                            {active.ask && (
                                <Line
                                    type="monotone"
                                    dataKey="ask"
                                    stroke={
                                        SERIES_CONFIG.ask
                                            .color
                                    }
                                    dot={false}
                                    strokeWidth={1.5}
                                    isAnimationActive={
                                        false
                                    }
                                />
                            )}

                            {active.last && (
                                <Line
                                    type="monotone"
                                    dataKey="last"
                                    stroke={
                                        SERIES_CONFIG.last
                                            .color
                                    }
                                    dot={false}
                                    strokeWidth={2}
                                    isAnimationActive={
                                        false
                                    }
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div
                    className={`flex h-[280px] items-center justify-center text-xs ${cx.textFaint}`}
                >
                    No historical data available for{" "}
                    {rangeLabel}.
                </div>
            )}
        </div>
    );
}