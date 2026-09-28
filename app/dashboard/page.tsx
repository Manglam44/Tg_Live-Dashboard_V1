"use client";

import { useMemo, useState } from "react";
import {
    BarChart3,
    Clock3,
    LogOut,
    RefreshCw,
    Search,
    Settings2,
    CircleDollarSign,
    TrendingUp,
    ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { displaySymbol, keyOf } from "@/lib/types";
import type { MarketQuote } from "@/lib/types";
import { COMMODITY_ORDER, CURRENCY_ORDER } from "@/lib/dashboard/constants";
import { formatExpiry, formatSize, formatTime, instrumentLabel } from "@/lib/dashboard/format";
import { cx } from "@/lib/dashboard/theme";
import { useMarketQuotes } from "@/hooks/useMarketQuotes";
import { Badge, PriceValue, SummaryCard, getInstrumentIcon } from "@/components/dashboard/primitives";
import { LiveDataAlertModal } from "@/components/dashboard/LiveDataAlertModal";

type MarketTab = "commodity" | "currency";
type MarketMode = "live" | "delayed";
type InstrumentFilter = "all" | "spot" | "future" | "option";

export default function MarketDashboard() {
    const router = useRouter();

    const [tab, setTab] = useState<MarketTab>("commodity");
    const [mode, setMode] = useState<MarketMode>("live");
    const [instrumentFilter, setInstrumentFilter] = useState<InstrumentFilter>("all");
    const [query, setQuery] = useState("");
    const [alertDismissed, setAlertDismissed] = useState(false);

    const commodity = useMarketQuotes("/api/market/commodity", mode, COMMODITY_ORDER);
    const currency = useMarketQuotes("/api/market/currency", mode, CURRENCY_ORDER);

    const active = tab === "commodity" ? commodity : currency;

    const filteredQuotes = useMemo(() => {
        const search = query.trim().toLowerCase();

        return active.quotes.filter((quote) => {
            const instrumentType = quote.instrument_type?.toLowerCase();

            if (instrumentFilter !== "all" && instrumentType !== instrumentFilter) return false;
            if (!search) return true;

            const searchableText = [
                displaySymbol(quote),
                quote.name,
                quote.symbol,
                quote.pair,
                quote.exchange,
                quote.underlying,
                quote.expiry,
                quote.right,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableText.includes(search);
        });
    }, [active.quotes, instrumentFilter, query]);

    const totalCount = active.quotes.length;
    const spotCount = active.quotes.filter((q) => q.instrument_type === "spot").length;
    const futureCount = active.quotes.filter((q) => q.instrument_type === "future").length;
    const optionCount = active.quotes.filter((q) => q.instrument_type === "option").length;

    const handleTab = (next: MarketTab) => {
        setTab(next);
        setInstrumentFilter("all");
        setQuery("");
    };

    const handleLogout = () => {
        document.cookie = "market_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        router.replace("/login");
        router.refresh();
    };

    const showAlert = active.liveDataDown && !alertDismissed;

    return (
        <main className={`min-h-screen ${cx.bgApp} ${cx.textPrimary}`}>
            <LiveDataAlertModal
                open={showAlert}
                onSwitchToDelayed={() => {
                    setMode("delayed");
                    setAlertDismissed(true);
                }}
                onRetry={() => {
                    active.refresh();
                    setAlertDismissed(true);
                }}
                onDismiss={() => setAlertDismissed(true)}
            />

            <div className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8">
                {/* HEADER */}
                <header className="mb-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border ${cx.border} ${cx.bgPanel}`}>
                                <BarChart3 className={`h-5 w-5 ${cx.accentText}`} />
                            </div>

                            <div>
                                <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                                    TransGraph Market Dashboard
                                </h1>
                                <p className={`mt-0.5 text-xs sm:text-sm ${cx.textFaint}`}>Real-time market data</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className={`flex items-center gap-2 rounded-md border ${cx.border} ${cx.bgPanel} px-3 py-2`}>
                                {active.liveDataDown ? (
                                    <>
                                        <span className={`relative flex h-2 w-2 rounded-full ${cx.warnBg}`} />
                                        <span className={`text-xs font-medium ${cx.warnText}`}>FEED DELAYED</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="relative flex h-2 w-2">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#089981] opacity-50" />
                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#089981]" />
                                        </span>
                                        <span className={`text-xs font-medium ${cx.up}`}>
                                            {mode === "live" ? "LIVE" : "DELAYED"}
                                        </span>
                                    </>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={active.refresh}
                                disabled={active.refreshing}
                                className={`inline-flex h-9 items-center gap-2 rounded-md border ${cx.border} ${cx.bgPanel} px-3 text-xs font-medium ${cx.textPrimary} transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${active.refreshing ? "animate-spin" : ""}`} />
                                Refresh
                            </button>

                            <button
                                type="button"
                                onClick={handleLogout}
                                className={`inline-flex h-9 items-center gap-2 rounded-md border ${cx.border} ${cx.bgPanel} px-3 text-xs font-medium text-[#f23645] transition hover:bg-white/[0.06]`}
                            >
                                <LogOut className="h-3.5 w-3.5" />
                                Sign Out
                            </button>
                        </div>
                    </div>
                </header>

                {/* TOP NAV */}
                <section className="mb-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className={`inline-flex w-fit rounded-md border ${cx.border} ${cx.bgPanelSoft} p-1`}>
                            {(["commodity", "currency"] as const).map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => handleTab(value)}
                                    className={`rounded px-5 py-2.5 text-sm font-medium capitalize transition ${tab === value ? `${cx.bgPanel} text-white` : `${cx.textFaint} hover:text-slate-300`
                                        }`}
                                >
                                    {value === "commodity" ? "Commodities" : "Currency"}
                                </button>
                            ))}
                        </div>

                        <div className={`inline-flex w-fit rounded-md border ${cx.border} ${cx.bgPanelSoft} p-1`}>
                            <button
                                type="button"
                                onClick={() => setMode("live")}
                                className={`rounded px-4 py-2 text-xs font-medium transition ${mode === "live" ? "bg-[#089981]/10 text-[#089981]" : `${cx.textFaint} hover:text-slate-300`
                                    }`}
                            >
                                Live
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode("delayed")}
                                className={`rounded px-4 py-2 text-xs font-medium transition ${mode === "delayed" ? "bg-[#f0a30a]/10 text-[#f0a30a]" : `${cx.textFaint} hover:text-slate-300`
                                    }`}
                            >
                                Delayed
                            </button>
                        </div>
                    </div>
                </section>

                {/* SUMMARY */}
                <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <SummaryCard title="Instruments" value={totalCount} icon={BarChart3} description="Unique instruments" />
                    <SummaryCard title="Spot" value={spotCount} icon={CircleDollarSign} description="Spot instruments" />
                    <SummaryCard title="Futures" value={futureCount} icon={TrendingUp} description="Future contracts" />
                    <SummaryCard title="Options" value={optionCount} icon={Settings2} description="Option contracts" />
                </section>

                {/* FILTERS */}
                <section className={`mb-4 rounded-md border ${cx.border} ${cx.bgPanelSoft} p-3`}>
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {(
                                [
                                    ["all", "All"],
                                    ["spot", "Spot"],
                                    ["future", "Future"],
                                    ["option", "Option"],
                                ] as const
                            ).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setInstrumentFilter(value)}
                                    className={`rounded px-3 py-2 text-xs font-medium transition ${instrumentFilter === value
                                        ? `${cx.bgPanel} text-white`
                                        : `${cx.textFaint} hover:bg-white/5 hover:text-slate-300`
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="relative w-full xl:max-w-sm">
                            <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${cx.textFaint}`} />
                            <input
                                type="text"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search instrument..."
                                className={`h-10 w-full rounded-md border ${cx.border} bg-black/20 pl-9 pr-3 text-sm ${cx.textPrimary} outline-none placeholder:${cx.textFaint} focus:border-[#2962ff]/40 focus:ring-1 focus:ring-[#2962ff]/25`}
                            />
                        </div>
                    </div>
                </section>

                {/* ERROR */}
                {active.error && (
                    <div className="mb-4 rounded-md border border-[#f23645]/25 bg-[#f23645]/[0.07] px-4 py-3">
                        <p className="text-sm font-medium text-[#f23645]">Market data error</p>
                        <p className="mt-1 text-xs text-[#f23645]/75">{active.error}</p>
                    </div>
                )}

                {/* TABLE */}
                <section className={`overflow-hidden rounded-md border ${cx.border} ${cx.bgPanelSoft}`}>
                    <div className={`flex flex-col gap-2 border-b ${cx.border} px-4 py-4 sm:flex-row sm:items-center sm:justify-between`}>
                        <div>
                            <h2 className="text-sm font-semibold text-white">
                                {tab === "commodity" ? "Commodity Market" : "Currency Market"}
                            </h2>
                            <p className={`mt-1 text-xs ${cx.textFaint}`}>{filteredQuotes.length} instruments</p>
                        </div>

                        <div className={`flex items-center gap-4 text-xs ${cx.textMuted}`}>
                            <div className="flex items-center gap-1.5">
                                <Clock3 className="h-3.5 w-3.5" />
                                <span>Updated {active.updated ? formatTime(active.updated.toISOString()) : "—"}</span>
                            </div>
                        </div>
                    </div>

                    {active.loading ? (
                        <div className="flex min-h-[420px] items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                                <RefreshCw className={`h-6 w-6 animate-spin ${cx.textMuted}`} />
                                <p className={`text-sm ${cx.textMuted}`}>Loading market data...</p>
                            </div>
                        </div>
                    ) : filteredQuotes.length === 0 ? (
                        <div className="flex min-h-[420px] items-center justify-center">
                            <div className="text-center">
                                <Search className={`mx-auto mb-3 h-6 w-6 ${cx.textFaint}`} />
                                <h3 className="text-sm font-medium text-slate-300">No instruments found</h3>
                                <p className={`mt-1 text-xs ${cx.textFaint}`}>Try another search or filter.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1150px] border-collapse">
                                <thead>
                                    <tr className={`border-b ${cx.border} bg-black/10`}>
                                        {["Instrument", "Type", "Exchange"].map((h) => (
                                            <th key={h} className={`px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider ${cx.textFaint}`}>
                                                {h}
                                            </th>
                                        ))}
                                        {["Bid", "Ask", "Last", "Bid Size", "Ask Size"].map((h) => (
                                            <th key={h} className={`px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider ${cx.textFaint}`}>
                                                {h}
                                            </th>
                                        ))}
                                        <th className={`px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider ${cx.textFaint}`}>Contract</th>
                                        <th className={`px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider ${cx.textFaint}`}>Updated</th>
                                        <th className="w-10 px-2 py-3" />
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredQuotes.map((quote) => (
                                        <QuoteRow key={keyOf(quote)} quote={quote} mode={mode} onClick={() => navigateToDetail(router, quote, mode)} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className={`flex items-center gap-2 text-[11px] ${cx.textFaint}`}>
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#089981] opacity-30" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#089981]/70" />
                        </span>

                        {mode === "live"
                            ? "Live prices update in real time"
                            : "Delayed prices update periodically"}
                    </div>
                </section>
            </div>
        </main>
    );
}

function navigateToDetail(
    router: ReturnType<typeof useRouter>,
    quote: MarketQuote,
    mode: MarketMode
) {
    const params = new URLSearchParams();

    params.set("name", quote.name ?? "");
    params.set("symbol", quote.symbol ?? "");
    params.set("mode", mode);
    params.set("instrument_type", quote.instrument_type ?? "");

    if (quote.expiry) params.set("expiry", quote.expiry);
    if (quote.strike != null) params.set("strike", String(quote.strike));
    if (quote.right) params.set("right", quote.right);

    router.push(
        `/market/${quote.asset_class}/${encodeURIComponent(
            displaySymbol(quote)
        )}?${params.toString()}`
    );
}

function InstrumentIcon({
    type,
    className,
}: {
    type: string;
    className?: string;
}) {
    const Icon = getInstrumentIcon(type);
    return <Icon className={className} />;
}

function QuoteRow({ quote, mode, onClick }: { quote: MarketQuote; mode: MarketMode; onClick: () => void }) {
    const type = quote.instrument_type;
    const isCurrency = quote.asset_class === "currency";
    const decimals = isCurrency ? 5 : 2;

    return (
        <tr onClick={onClick} className={`group cursor-pointer border-b ${cx.borderSoft} transition hover:bg-white/[0.04]`}>
            <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${cx.borderSoft} ${cx.bgPanel}`}>
                        <InstrumentIcon
                            type={quote.instrument_type}
                            className={`h-4 w-4 ${cx.textMuted}`}
                        />
                    </div>

                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-100">{displaySymbol(quote)}</span>
                            {mode === "live" && <Badge variant="live">LIVE</Badge>}
                        </div>
                        <p className={`mt-1 max-w-[220px] truncate text-xs ${cx.textFaint}`}>
                            {quote.name || quote.underlying || "—"}
                        </p>
                    </div>
                </div>
            </td>

            <td className="px-4 py-4">
                <Badge variant={type === "future" ? "future" : type === "option" ? "option" : "spot"}>
                    {instrumentLabel(type)}
                </Badge>
            </td>

            <td className={`px-4 py-4 text-xs font-medium ${cx.textMuted}`}>{quote.exchange || "—"}</td>

            <td className="px-4 py-4 text-right">
                <PriceValue value={quote.bid} decimals={decimals} />
            </td>
            <td className="px-4 py-4 text-right">
                <PriceValue value={quote.ask} decimals={decimals} />
            </td>
            <td className="px-4 py-4 text-right">
                <PriceValue value={quote.last} decimals={decimals} />
            </td>

            <td className={`px-4 py-4 text-right font-mono text-xs tabular-nums ${cx.textMuted}`}>{formatSize(quote.bid_size)}</td>
            <td className={`px-4 py-4 text-right font-mono text-xs tabular-nums ${cx.textMuted}`}>{formatSize(quote.ask_size)}</td>

            <td className="px-4 py-4">
                {type === "future" && (
                    <div>
                        <p className="font-mono text-xs text-slate-300">{formatExpiry(quote.expiry) || "—"}</p>
                        <p className={`mt-1 text-[10px] ${cx.textFaint}`}>Expiry</p>
                    </div>
                )}

                {type === "option" && (
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-300">{quote.expiry || "—"}</span>
                            {quote.right && <Badge variant="option">{quote.right}</Badge>}
                        </div>
                        <p className={`mt-1 text-[10px] ${cx.textFaint}`}>Strike {quote.strike ?? "—"}</p>
                    </div>
                )}

                {type === "spot" && <span className={`text-xs ${cx.textFaint}`}>Spot</span>}
            </td>

            <td className={`px-4 py-4 text-right font-mono text-[11px] tabular-nums ${cx.textFaint}`}>{formatTime(quote?.ticker_time)}</td>

            <td className="px-2 py-4">
                <ChevronRight className={`h-4 w-4 ${cx.textFaint} transition group-hover:translate-x-0.5 group-hover:text-slate-300`} />
            </td>
        </tr>
    );
}
