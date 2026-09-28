"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { MarketQuote } from "@/lib/types";
import { formatDateTime, formatNumber, formatExpiry } from "@/lib/dashboard/format";
import { expiryTimestamp } from "@/lib/dashboard/quotes";

import { DetailItem, PriceCard } from "@/components/market-detail/primitives";
import { PriceHistoryChart } from "@/components/market-detail/PriceHistoryChart";
import { RelatedDataTable } from "@/components/market-detail/RelatedDataTable";

interface CommodityInstrumentDetailProps {
    quotes: MarketQuote[];
    latestQuote: MarketQuote;
    decimals: number;

    /**
     * Expiry from the URL.
     *
     * This is only used as the initial selected contract, applied
     * once on first load. It does NOT restrict the API request, and
     * it must never override a selection the user has since made.
     */
    initialExpiry?: string;
}

interface ContractRow {
    expiry: string;
    quote: MarketQuote;
}

export function CommodityInstrumentDetail({
    quotes,
    latestQuote,
    decimals,
    initialExpiry = "",
}: CommodityInstrumentDetailProps) {
    /*
     * ------------------------------------------------------------
     * AVAILABLE EXPIRIES
     * ------------------------------------------------------------
     */

    const contracts = useMemo<ContractRow[]>(() => {
        const expiryMap = new Map<string, MarketQuote>();

        for (const quote of quotes) {
            if (!quote.expiry) {
                continue;
            }

            const existing = expiryMap.get(quote.expiry);

            if (!existing) {
                expiryMap.set(quote.expiry, quote);
                continue;
            }

            if (
                new Date(quote.ticker_time).getTime() >
                new Date(existing.ticker_time).getTime()
            ) {
                expiryMap.set(quote.expiry, quote);
            }
        }

        return Array.from(expiryMap.entries())
            .map(([expiry, quote]) => ({
                expiry,
                quote,
            }))
            .sort(
                (a, b) =>
                    expiryTimestamp(a.expiry) -
                    expiryTimestamp(b.expiry)
            );
    }, [quotes]);

    /*
     * ------------------------------------------------------------
     * SELECTED EXPIRY
     * ------------------------------------------------------------
     *
     * initialExpiry (from the URL) is applied ONCE, on first load.
     * After that, this state is fully user-controlled: polling must
     * never reset it back to the initial contract. The only automatic
     * correction allowed afterwards is when the currently selected
     * contract disappears from the data entirely (e.g. it rolled off),
     * in which case we fall back to the nearest available contract.
     */

    const [selectedExpiry, setSelectedExpiry] = useState<string>(
        initialExpiry
    );

    const hasAppliedInitialExpiry = useRef(false);

    useEffect(() => {
        if (contracts.length === 0) {
            return;
        }

        if (!hasAppliedInitialExpiry.current) {
            hasAppliedInitialExpiry.current = true;

            const initialExists = contracts.some(
                (contract) => contract.expiry === initialExpiry
            );

            setSelectedExpiry(
                initialExists ? initialExpiry : contracts[0].expiry
            );
            return;
        }

        // Initial selection already applied on an earlier render.
        // Only step in if the user's current selection is no longer
        // present in the data (e.g. contract expired/rolled off) —
        // never overwrite a valid, still-present user selection.
        setSelectedExpiry((current) => {
            const currentExists = contracts.some(
                (contract) => contract.expiry === current
            );

            return currentExists ? current : contracts[0].expiry;
        });
    }, [contracts, initialExpiry]);

    /*
     * ------------------------------------------------------------
     * SELECTED CONTRACT DATA
     * ------------------------------------------------------------
     */

    const selectedQuotes = useMemo(() => {
        if (!selectedExpiry) {
            return [];
        }

        return quotes?.filter((quote) => quote.expiry === selectedExpiry)?.sort((a, b) =>
            new Date(b.ticker_time).getTime() -
            new Date(a.ticker_time).getTime()
        );
    }, [quotes, selectedExpiry]);

    const selectedLatestQuote = useMemo(() => {
        return selectedQuotes[0] ?? latestQuote;
    }, [selectedQuotes, latestQuote]);

    /*
     * ------------------------------------------------------------
     * RENDER
     * ------------------------------------------------------------
     */

    return (
        <>
            {/* PRICE */}
            <section className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                <PriceCard
                    label="Bid"
                    value={selectedLatestQuote.bid}
                    decimals={decimals}
                />

                <PriceCard
                    label="Ask"
                    value={selectedLatestQuote.ask}
                    decimals={decimals}
                />

                <PriceCard
                    label="Last"
                    value={selectedLatestQuote.last}
                    decimals={decimals}
                />
            </section>

            {/* CONTRACT / EXPIRY TABLE */}
            <section className="mb-5">
                <div className="mb-3">
                    <h2 className="text-sm font-semibold text-white">
                        {selectedLatestQuote.name ?? "Commodity"} Futures
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                        Select an expiry contract to view its historical
                        price data.
                    </p>
                </div>

                <div className="overflow-x-auto rounded-md border border-white/[0.08] bg-white/[0.02]">
                    <table className="w-full min-w-[900px] border-collapse">
                        <thead>
                            <tr className="border-b border-white/[0.08] bg-black/20">
                                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Contract
                                </th>

                                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Bid
                                </th>

                                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Ask
                                </th>

                                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Last
                                </th>

                                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Bid Size
                                </th>

                                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Ask Size
                                </th>

                                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Updated
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {contracts.map(({ expiry, quote }) => {
                                const isSelected = expiry === selectedExpiry;
                                return (
                                    <tr
                                        key={expiry}
                                        onClick={() =>
                                            setSelectedExpiry(expiry)
                                        }
                                        className={[
                                            "cursor-pointer border-b border-white/[0.05] transition",
                                            isSelected
                                                ? "bg-[#2962ff]/10"
                                                : "hover:bg-white/[0.04]",
                                        ].join(" ")}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div>
                                                    <p
                                                        className={[
                                                            "font-mono text-sm font-semibold",
                                                            isSelected
                                                                ? "text-white"
                                                                : "text-slate-300",
                                                        ].join(" ")}
                                                    >
                                                        {formatExpiry(
                                                            expiry
                                                        ) || expiry}
                                                    </p>

                                                    <p className="mt-0.5 text-[10px] text-slate-500">
                                                        {expiry}
                                                    </p>
                                                </div>

                                                {isSelected && (
                                                    <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#2962ff]">
                                                        Selected
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-300">
                                            {formatNumber(
                                                quote.bid,
                                                decimals
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-300">
                                            {formatNumber(
                                                quote.ask,
                                                decimals
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-white">
                                            {formatNumber(
                                                quote.last,
                                                decimals
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">
                                            {formatNumber(
                                                quote.bid_size,
                                                2
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">
                                            {formatNumber(
                                                quote.ask_size,
                                                2
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-right font-mono text-[10px] text-slate-500">
                                            {formatDateTime(
                                                quote?.ticker_time
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* CHART */}
            <section className="mb-5">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-white">
                            Price History
                        </h2>

                        <p className="mt-1 text-xs text-slate-500">
                            {selectedExpiry
                                ? `Contract: ${formatExpiry(selectedExpiry) ||
                                selectedExpiry
                                }`
                                : "Select an expiry contract"}
                        </p>
                    </div>
                </div>

                <PriceHistoryChart
                    quotes={selectedQuotes}
                    decimals={decimals}
                />
            </section>

            {/* CONTRACT INFO */}
            <section className="mb-5">
                <div className="mb-3">
                    <h2 className="text-sm font-semibold text-white">
                        Contract Information
                    </h2>

                    <p className="mt-1 text-xs text-slate-600">
                        Information for the selected futures contract.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                    <DetailItem
                        label="Name"
                        value={selectedLatestQuote.name}
                    />

                    <DetailItem
                        label="Symbol"
                        value={selectedLatestQuote.symbol}
                        mono
                    />

                    <DetailItem
                        label="Underlying"
                        value={selectedLatestQuote.underlying}
                        mono
                    />

                    <DetailItem
                        label="Asset Class"
                        value={selectedLatestQuote.asset_class}
                    />

                    <DetailItem
                        label="Instrument Type"
                        value={selectedLatestQuote.instrument_type}
                    />

                    <DetailItem
                        label="Exchange"
                        value={selectedLatestQuote.exchange}
                    />

                    <DetailItem
                        label="Mode"
                        value={selectedLatestQuote.mode}
                    />

                    <DetailItem
                        label="Expiry"
                        value={selectedLatestQuote.expiry}
                        mono
                    />

                    <DetailItem
                        label="Strike"
                        value={selectedLatestQuote.strike}
                        mono
                    />

                    <DetailItem
                        label="Right"
                        value={selectedLatestQuote.right}
                    />

                    <DetailItem
                        label="Bid Size"
                        value={formatNumber(
                            selectedLatestQuote.bid_size,
                            2
                        )}
                        mono
                    />

                    <DetailItem
                        label="Ask Size"
                        value={formatNumber(
                            selectedLatestQuote.ask_size,
                            2
                        )}
                        mono
                    />

                    <DetailItem
                        label="Last Size"
                        value={formatNumber(
                            selectedLatestQuote.last_size,
                            2
                        )}
                        mono
                    />

                    <DetailItem
                        label="Ticker Time"
                        value={selectedLatestQuote.ticker_time}
                        mono
                    />

                    <DetailItem
                        label="Ticker Time Zone"
                        value={selectedLatestQuote.ticker_time_zone}
                    />

                    <DetailItem
                        label="Quote Time"
                        value={formatDateTime(
                            selectedLatestQuote.ticker_time
                        )}
                    />
                </div>
            </section>

            {/* SELECTED CONTRACT HISTORICAL DATA */}
            <RelatedDataTable
                quotes={selectedQuotes}
                decimals={decimals}
                latestQuoteTime={selectedLatestQuote.ticker_time}
            />
        </>
    );
}