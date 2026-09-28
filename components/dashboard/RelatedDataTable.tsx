import {
    Clock3,
    Database,
} from "lucide-react";

import type { MarketQuote } from "@/lib/types";
import { keyOf } from "@/lib/types";
import { cx } from "@/lib/dashboard/theme";
import {
    formatDateTime,
    formatNumber,
} from "@/lib/dashboard/format";

interface RelatedDataTableProps {
    quotes: MarketQuote[];
    decimals: number;
    latestQuoteTime: string;
}

export function RelatedDataTable({
    quotes,
    decimals,
    latestQuoteTime,
}: RelatedDataTableProps) {
    const showContractColumns =
        quotes.some(
            (q) =>
                Boolean(q.expiry) ||
                q.strike != null ||
                Boolean(q.right)
        );

    return (
        <section
            className={`overflow-hidden rounded-md border ${cx.border} ${cx.bgPanel}`}
        >
            <div
                className={`flex flex-col gap-3 border-b ${cx.border} px-4 py-4 sm:flex-row sm:items-center sm:justify-between`}
            >
                <div>
                    <div className="flex items-center gap-2">
                        <Database
                            className={`h-4 w-4 ${cx.textMuted}`}
                        />
                        <h2 className="text-sm font-semibold text-white">
                            Related Instrument Data
                        </h2>
                    </div>

                    <p
                        className={`mt-1 text-xs ${cx.textFaint}`}
                    >
                        {quotes.length} contract
                        {quotes.length === 1
                            ? ""
                            : "s"} returned.
                    </p>
                </div>

                <div
                    className={`flex items-center gap-2 text-xs ${cx.textMuted}`}
                >
                    <Clock3 className="h-3.5 w-3.5" />
                    Latest:{" "}
                    {latestQuoteTime
                        ? formatDateTime(
                              latestQuoteTime
                          )
                        : "—"}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px]">
                    <thead>
                        <tr
                            className={`border-b ${cx.border} bg-black/10`}
                        >
                            <th
                                className={`px-4 py-3 text-left text-[10px] uppercase tracking-wider ${cx.textFaint}`}
                            >
                                Type
                            </th>
                            <th
                                className={`px-4 py-3 text-left text-[10px] uppercase tracking-wider ${cx.textFaint}`}
                            >
                                Exchange
                            </th>
                            <th
                                className={`px-4 py-3 text-right text-[10px] uppercase tracking-wider ${cx.textFaint}`}
                            >
                                Bid
                            </th>
                            <th
                                className={`px-4 py-3 text-right text-[10px] uppercase tracking-wider ${cx.textFaint}`}
                            >
                                Ask
                            </th>
                            <th
                                className={`px-4 py-3 text-right text-[10px] uppercase tracking-wider ${cx.textFaint}`}
                            >
                                Last
                            </th>
                            <th
                                className={`px-4 py-3 text-right text-[10px] uppercase tracking-wider ${cx.textFaint}`}
                            >
                                Bid Size
                            </th>
                            <th
                                className={`px-4 py-3 text-right text-[10px] uppercase tracking-wider ${cx.textFaint}`}
                            >
                                Ask Size
                            </th>

                            {showContractColumns && (
                                <>
                                    <th
                                        className={`px-4 py-3 text-left text-[10px] uppercase tracking-wider ${cx.textFaint}`}
                                    >
                                        Expiry
                                    </th>
                                    <th
                                        className={`px-4 py-3 text-right text-[10px] uppercase tracking-wider ${cx.textFaint}`}
                                    >
                                        Strike
                                    </th>
                                    <th
                                        className={`px-4 py-3 text-left text-[10px] uppercase tracking-wider ${cx.textFaint}`}
                                    >
                                        Right
                                    </th>
                                </>
                            )}

                            <th
                                className={`px-4 py-3 text-right text-[10px] uppercase tracking-wider ${cx.textFaint}`}
                            >
                                Quote Time
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {quotes.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={
                                        showContractColumns
                                            ? 11
                                            : 8
                                    }
                                    className={`px-4 py-10 text-center text-sm ${cx.textFaint}`}
                                >
                                    No quote data available.
                                </td>
                            </tr>
                        ) : (
                            quotes.map((quote) => (
                                <tr
                                    key={keyOf(quote)}
                                    className={`border-b ${cx.borderSoft}`}
                                >
                                    <td className="px-4 py-3 text-xs text-slate-300">
                                        {quote.instrument_type}
                                    </td>

                                    <td
                                        className={`px-4 py-3 text-xs ${cx.textMuted}`}
                                    >
                                        {quote.exchange ||
                                            "—"}
                                    </td>

                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                                        {formatNumber(
                                            quote.bid,
                                            decimals
                                        )}
                                    </td>

                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                                        {formatNumber(
                                            quote.ask,
                                            decimals
                                        )}
                                    </td>

                                    <td className="px-4 py-3 text-right font-mono text-xs font-medium tabular-nums text-white">
                                        {formatNumber(
                                            quote.last,
                                            decimals
                                        )}
                                    </td>

                                    <td
                                        className={`px-4 py-3 text-right font-mono text-xs tabular-nums ${cx.textMuted}`}
                                    >
                                        {formatNumber(
                                            quote.bid_size,
                                            2
                                        )}
                                    </td>

                                    <td
                                        className={`px-4 py-3 text-right font-mono text-xs tabular-nums ${cx.textMuted}`}
                                    >
                                        {formatNumber(
                                            quote.ask_size,
                                            2
                                        )}
                                    </td>

                                    {showContractColumns && (
                                        <>
                                            <td
                                                className={`px-4 py-3 font-mono text-xs ${cx.textMuted}`}
                                            >
                                                {quote.expiry ||
                                                    "—"}
                                            </td>

                                            <td
                                                className={`px-4 py-3 text-right font-mono text-xs tabular-nums ${cx.textMuted}`}
                                            >
                                                {quote.strike ??
                                                    "—"}
                                            </td>

                                            <td
                                                className={`px-4 py-3 text-xs ${cx.textMuted}`}
                                            >
                                                {quote.right ||
                                                    "—"}
                                            </td>
                                        </>
                                    )}

                                    <td
                                        className={`px-4 py-3 text-right font-mono text-[11px] tabular-nums ${cx.textFaint}`}
                                    >
                                        {formatDateTime(
                                            quote.ticker_time
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
