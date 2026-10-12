"use client";

import { useCallback, useEffect, useState } from "react";

interface HistoricalData {
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
    underlying: string | null;
    bid: number | null;
    ask: number | null;
    last: number | null;
    bid_size: number | null;
    ask_size: number | null;
    last_size: number | null;
}

interface HistoricalResponse {
    asset_group: string;
    mode: string;
    symbol: string;
    expiry: string;
    from: string | null;
    to: string | null;
    page: number;
    page_size: number;
    order: string;
    count: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
    data: HistoricalData[];
}

interface HistoricalDataTableProps {
    symbol: string;
    expiry: string | null;
    mode?: string;
    assetGroup?: string;
    commodityName?: string;
}

const PAGE_SIZE = 500;

export default function HistoricalDataTable({
    symbol,
    expiry,
    mode = "live",
    assetGroup = "commodity",
    commodityName,
}: HistoricalDataTableProps) {
    const [data, setData] = useState<HistoricalData[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrevious, setHasPrevious] = useState(false);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const formatPrice = (value: number | null) => {
        if (value === null || value === undefined) {
            return "-";
        }

        return value.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
        });
    };

    const formatSize = (value: number | null) => {
        if (value === null || value === undefined) {
            return "-";
        }

        return value.toLocaleString("en-US");
    };

    const formatDateTime = (value: string) => {
        if (!value) {
            return "-";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        }).format(date);
    };

    const formatExpiry = (value: string) => {
        if (!value || value.length !== 8) {
            return value;
        }

        const year = value.substring(0, 4);
        const month = value.substring(4, 6);
        const day = value.substring(6, 8);

        const date = new Date(
            Number(year),
            Number(month) - 1,
            Number(day)
        );

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
        }).format(date);
    };

    const fetchHistoricalData = useCallback(
        async (requestedPage: number, isRefresh = false) => {
            if (!symbol || !expiry) {
                setData([]);
                setTotal(0);
                setTotalPages(0);
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
                    asset_group: assetGroup,
                    symbol,
                    expiry,
                    mode,
                    page: String(requestedPage),
                    page_size: String(PAGE_SIZE),
                    order: "desc",
                });

                const response = await fetch(
                    `/api/market/instrument?${params.toString()}`,
                    {
                        method: "GET",
                        cache: "no-store",
                    }
                );

                if (!response.ok) {
                    const errorData = await response.json().catch(
                        () => null
                    );

                    throw new Error(
                        errorData?.error ||
                        `Failed to fetch historical data (${response.status})`
                    );
                }

                const result: HistoricalResponse =
                    await response.json();

                setData(result.data || []);

                setPage(result.page || requestedPage);

                setTotal(result.total || 0);
                setTotalPages(result.total_pages || 0);

                setHasNext(Boolean(result.has_next));
                setHasPrevious(Boolean(result.has_previous));
            } catch (err) {
                console.error(
                    "Historical data fetch error:",
                    err
                );

                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load historical data"
                );

                setData([]);
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [symbol, expiry, mode, assetGroup]
    );

    /*
     * Reset pagination whenever selected contract changes.
     */
    useEffect(() => {
        setPage(1);
    }, [symbol, expiry, mode]);

    /*
     * Fetch current page.
     */
    useEffect(() => {
        fetchHistoricalData(page);
    }, [page, fetchHistoricalData]);

    /*
     * Go to previous backend page.
     */
    const handlePrevious = () => {
        if (!hasPrevious || loading || refreshing) {
            return;
        }

        setPage((currentPage) => Math.max(1, currentPage - 1));
    };

    /*
     * Go to next backend page.
     */
    const handleNext = () => {
        if (!hasNext || loading || refreshing) {
            return;
        }

        setPage((currentPage) =>
            Math.min(totalPages, currentPage + 1)
        );
    };

    /*
     * Manual refresh keeps the current page.
     */
    const handleRefresh = () => {
        fetchHistoricalData(page, true);
    };

    /*
     * No contract selected.
     */
    if (!expiry) {
        return (
            <section className="rounded-xl border border-gray-200 bg-white">
                <div className="px-5 py-8 text-center">
                    <p className="text-sm text-gray-500">
                        Select a contract to view historical data.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            {/* Header */}
            <div className="border-b border-gray-200 px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            {/* <h2 className="text-lg font-semibold text-gray-900">
                                Historical Data
                            </h2> */}

                            <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                {symbol}
                            </span>

                            <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                                {formatExpiry(expiry)}
                            </span>
                        </div>

                        {/* <p className="mt-1 text-sm text-gray-500">
                            {commodityName
                                ? commodityName
                                : "Instrument"}{" "}
                            historical tick data
                        </p> */}
                    </div>

                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={loading || refreshing}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <svg
                            className={`h-4 w-4 ${refreshing
                                ? "animate-spin"
                                : ""
                                }`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4 4v5h5"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M20 20v-5h-5"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5.05 9A7 7 0 0117.95 5.05L20 7"
                            />
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M18.95 15A7 7 0 016.05 18.95L4 17"
                            />
                        </svg>

                        {refreshing
                            ? "Refreshing..."
                            : "Refresh"}
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                {/* <div className="text-sm text-gray-600">
                    <span className="font-medium text-gray-900">
                        {total.toLocaleString("en-US")}
                    </span>{" "}
                    total records
                </div> */}

                {/* <div className="text-xs text-gray-500">
                    500 records loaded per page
                </div> */}
            </div>

            {/* Error */}
            {error && (
                <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-red-700">
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                fetchHistoricalData(page)
                            }
                            className="text-sm font-medium text-red-700 underline hover:no-underline"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex min-h-[300px] items-center justify-center">
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                        Loading historical data...
                    </div>
                </div>
            )}

            {/* Empty */}
            {!loading && !error && data.length === 0 && (
                <div className="flex min-h-[300px] items-center justify-center px-5">
                    <p className="text-sm text-gray-500">
                        No historical data available for this
                        contract.
                    </p>
                </div>
            )}

            {/* Desktop Table */}
            {!loading && data.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[950px] text-left">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Time
                                </th>

                                <th className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Bid
                                </th>

                                <th className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Ask
                                </th>

                                <th className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Last
                                </th>

                                <th className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Bid Size
                                </th>

                                <th className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Ask Size
                                </th>

                                <th className="whitespace-nowrap px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Last Size
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                            {data.map((item, index) => (
                                <tr
                                    key={`${item.quote_time}-${index}`}
                                    className="transition-colors hover:bg-gray-50"
                                >
                                    <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-700">
                                        {formatDateTime(
                                            item.quote_time
                                        )}
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-3 text-right text-sm font-medium text-gray-900">
                                        {formatPrice(item.bid)}
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-3 text-right text-sm font-medium text-gray-900">
                                        {formatPrice(item.ask)}
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-3 text-right text-sm font-semibold text-gray-900">
                                        {formatPrice(item.last)}
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-3 text-right text-sm text-gray-600">
                                        {formatSize(
                                            item.bid_size
                                        )}
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-3 text-right text-sm text-gray-600">
                                        {formatSize(
                                            item.ask_size
                                        )}
                                    </td>

                                    <td className="whitespace-nowrap px-5 py-3 text-right text-sm text-gray-600">
                                        {formatSize(
                                            item.last_size
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 0 && (
                <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-gray-500">
                        Page{" "}
                        <span className="font-semibold text-gray-900">
                            {page}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-gray-900">
                            {totalPages}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrevious}
                            disabled={
                                !hasPrevious ||
                                loading ||
                                refreshing
                            }
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            ← Previous
                        </button>

                        <div className="min-w-[90px] text-center text-sm font-medium text-gray-700">
                            {page} / {totalPages}
                        </div>

                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={
                                !hasNext ||
                                loading ||
                                refreshing
                            }
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}