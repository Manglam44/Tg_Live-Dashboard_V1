"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import InstrumentPriceChart from "@/components/market/InstrumentPriceChart";
import HistoricalDataTable from "@/components/market/HistoricalDataTable";

interface ContractQuote {
    symbol: string;
    expiry: string;
    instrument_type: string;
    exchange: string;
    last: number | null;
    bid: number | null;
    ask: number | null;
    quote_time: string;
    ticker_time: string;
}

interface ContractsResponse {
    asset_group: string;
    mode: string;
    symbol: string;
    count: number;
    data: ContractQuote[];
}

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

function formatPrice(value: number | null | undefined) {
    if (value === null || value === undefined) {
        return "-";
    }

    return value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    });
}

function formatDateTime(value: string | null | undefined) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

export default function InstrumentDetailPage() {
    const searchParams = useSearchParams();
    const mode = searchParams.get("mode") || "live";
    const instrumentType = searchParams.get("instrument_type") || "future";
    const commodityName = searchParams.get("name") || "";
    const symbol = searchParams.get("symbol") || "";
    const expiry = searchParams.get("expiry") || "";

    const [contracts, setContracts] = useState<ContractQuote[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedExpiry, setSelectedExpiry] = useState<string | null>(expiry || null);

    const fetchContracts = useCallback(
        async (isRefresh = false) => {
            if (!symbol) {
                setError("Instrument symbol is missing.");
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
                    mode,
                });

                const response = await fetch(`/api/market/contracts?${params.toString()}`,
                    {
                        method: "GET",
                        cache: "no-store",
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch contracts (${response.status})`
                    );
                }

                const result: ContractsResponse = await response.json();

                const today = new Date();

                const todayString =
                    today.getFullYear().toString() +
                    String(today.getMonth() + 1).padStart(2, "0") +
                    String(today.getDate()).padStart(2, "0");

                const activeContracts = (result.data || [])
                    .filter((contract) => {
                        // Keep only contracts that have not expired
                        return contract.expiry >= todayString;
                    })
                    .sort((a, b) =>
                        a.expiry.localeCompare(b.expiry)
                    );

                setContracts(activeContracts);
            } catch (err) {
                console.error(
                    "Failed to fetch instrument contracts:",
                    err
                );

                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to fetch market data."
                );
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [mode, symbol]
    );

    useEffect(() => {
        fetchContracts();

        const interval = window.setInterval(() => {
            fetchContracts(true);
        }, 10_000);

        return () => {
            window.clearInterval(interval);
        };
    }, [fetchContracts]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 p-6">
                <div className="mx-auto max-w-7xl">
                    <div className="animate-pulse space-y-6">
                        <div className="h-8 w-72 rounded bg-gray-200" />

                        <div className="h-20 rounded-xl bg-white" />

                        <div className="h-96 rounded-xl bg-white" />
                    </div>
                </div>
            </div>
        );
    }

    if (error && contracts.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 p-6">
                <div className="mx-auto max-w-7xl">
                    <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                        <h2 className="text-lg font-semibold text-red-700">
                            Unable to load market data
                        </h2>

                        <p className="mt-2 text-sm text-red-600">
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={() => fetchContracts()}
                            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl space-y-6 p-6">

                {/* =========================================
                    Instrument Header
                ========================================== */}

                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-900">
                                {commodityName || symbol}
                            </h1>

                            <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                                {symbol}
                            </span>

                            <span className="rounded-md bg-green-100 px-2.5 py-1 text-xs font-semibold uppercase text-green-700">
                                {mode}
                            </span>
                        </div>

                        <p className="mt-1 text-sm text-gray-500">
                            {instrumentType === "future"
                                ? "Commodity Futures"
                                : instrumentType}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span
                            className={`h-2 w-2 rounded-full ${refreshing
                                ? "animate-pulse bg-yellow-500"
                                : "bg-green-500"
                                }`}
                        />

                        {refreshing
                            ? "Updating..."
                            : "Live data"}
                    </div>
                </div>

                {/* =========================================
                    All Contracts
                ========================================== */}
                <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">

                    {/* Section Header */}
                    <div className="flex flex-col justify-between gap-3 border-b border-gray-200 p-5 sm:flex-row sm:items-center">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">
                                Future Contracts
                            </h2>

                            <p className="mt-1 text-sm text-gray-500">
                                All available contracts for{" "}
                                <span className="font-medium text-gray-700">
                                    {symbol}
                                </span>
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                                {contracts.length} Contracts
                            </span>

                            {refreshing && (
                                <span className="text-xs text-gray-500">
                                    Refreshing...
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50">
                                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        #
                                    </th>

                                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Contract
                                    </th>

                                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Expiry
                                    </th>

                                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Last
                                    </th>

                                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Bid
                                    </th>

                                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Ask
                                    </th>

                                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Exchange
                                    </th>

                                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Quote Time
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-100">
                                {contracts?.map((contract, index) => {
                                    return (
                                        <tr
                                            key={`${contract.symbol}-${contract.expiry}`}
                                            onClick={() => setSelectedExpiry(contract.expiry)}
                                            className={`cursor-pointer transition-colors ${selectedExpiry === contract.expiry
                                                ? "bg-blue-50"
                                                : "hover:bg-gray-50"
                                                }`}
                                        >
                                            <td className="px-5 py-4 text-sm text-gray-400">
                                                {index + 1}
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="font-semibold text-gray-900">
                                                    {contract.symbol}
                                                </div>

                                                <div className="text-xs capitalize text-gray-500">
                                                    {
                                                        contract.instrument_type
                                                    }
                                                </div>
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="font-medium text-gray-900">
                                                    {formatExpiry(
                                                        contract.expiry
                                                    )}
                                                </div>

                                                <div className="text-xs text-gray-400">
                                                    {
                                                        contract.expiry
                                                    }
                                                </div>
                                            </td>

                                            <td className="px-5 py-4 text-right">
                                                <span className="font-semibold text-gray-900">
                                                    {formatPrice(
                                                        contract.last
                                                    )}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4 text-right">
                                                <span className="font-medium text-gray-700">
                                                    {formatPrice(
                                                        contract.bid
                                                    )}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4 text-right">
                                                <span className="font-medium text-gray-700">
                                                    {formatPrice(
                                                        contract.ask
                                                    )}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4">
                                                <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                                                    {
                                                        contract.exchange
                                                    }
                                                </span>
                                            </td>

                                            <td className="px-5 py-4 text-sm text-gray-500">
                                                {formatDateTime(
                                                    contract.quote_time
                                                )}
                                            </td>
                                        </tr>
                                    )
                                }
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="divide-y divide-gray-100 md:hidden">
                        {contracts?.map(
                            (contract, index) => (
                                <div
                                    key={`${contract.symbol}-${contract.expiry}`}
                                    className="p-5"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400">
                                                    {index + 1}
                                                </span>

                                                <span className="font-semibold text-gray-900">
                                                    {contract.symbol}
                                                </span>
                                            </div>

                                            <p className="mt-1 text-sm text-gray-500">
                                                {contract.instrument_type}
                                            </p>
                                        </div>

                                        <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                                            {contract.exchange}
                                        </span>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-4">
                                        <PriceItem
                                            label="Last"
                                            value={formatPrice(
                                                contract.last
                                            )}
                                        />

                                        <PriceItem
                                            label="Bid"
                                            value={formatPrice(
                                                contract.bid
                                            )}
                                        />

                                        <PriceItem
                                            label="Ask"
                                            value={formatPrice(
                                                contract.ask
                                            )}
                                        />

                                        <PriceItem
                                            label="Expiry"
                                            value={formatExpiry(
                                                contract.expiry
                                            )}
                                        />
                                    </div>

                                    <div className="mt-4 border-t border-gray-100 pt-3">
                                        <p className="text-xs text-gray-400">
                                            Quote Time
                                        </p>

                                        <p className="mt-1 text-xs text-gray-600">
                                            {formatDateTime(
                                                contract.quote_time
                                            )}
                                        </p>
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    {/* Empty */}
                    {contracts.length === 0 && (
                        <div className="p-10 text-center">
                            <p className="text-sm text-gray-500">
                                No contracts available.
                            </p>
                        </div>
                    )}
                </section>

                {/* =========================================
                    Future Steps
                ========================================== */}
                <section className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
                    <InstrumentPriceChart
                        symbol={symbol}
                        expiry={selectedExpiry}
                        mode={mode}
                        commodityName={commodityName}
                    />
                </section>

                <HistoricalDataTable
                    symbol={symbol}
                    expiry={selectedExpiry}
                    mode={mode}
                    assetGroup="commodity"
                    commodityName={commodityName}
                />

            </div>
        </div>
    );
}

function PriceItem({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div>
            <p className="text-xs text-gray-500">
                {label}
            </p>

            <p className="mt-1 text-sm font-semibold text-gray-900">
                {value}
            </p>
        </div>
    );
}