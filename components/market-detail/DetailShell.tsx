"use client";

import { ArrowLeft, Activity, RefreshCw, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MarketQuote } from "@/lib/types";
import { cx } from "@/lib/dashboard/theme";

interface DetailShellProps {
    title: string;
    assetClass: string;
    instrumentType: string;
    mode: string;
    latestQuote: MarketQuote | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    onRefresh: () => void;
    children: React.ReactNode;
}

export function DetailShell({
    title,
    assetClass,
    instrumentType,
    mode,
    latestQuote,
    loading,
    refreshing,
    error,
    onRefresh,
    children,
}: DetailShellProps) {
    const router = useRouter();

    return (
        <main className={`min-h-screen ${cx.bgApp} ${cx.textPrimary}`}>
            <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
                <header className="mb-6">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className={`mb-5 inline-flex items-center gap-2 rounded-md border ${cx.border} ${cx.bgPanel} px-3 py-2 text-xs font-medium ${cx.textMuted} transition hover:bg-white/[0.06] hover:text-white`}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Market
                    </button>

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-md border ${cx.border} ${cx.bgPanel}`}>
                                <BarChart3 className={`h-5 w-5 ${cx.accentText}`} />
                            </div>

                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
                                    <span className="rounded border border-[#089981]/30 bg-[#089981]/10 px-2.5 py-1 text-[11px] font-medium uppercase text-[#089981]">
                                        {mode}
                                    </span>
                                </div>
                                <p className={`mt-1 text-xs ${cx.textFaint}`}>
                                    {assetClass} • {instrumentType || latestQuote?.instrument_type || "instrument"}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className={`flex items-center gap-2 rounded-md border ${cx.border} ${cx.bgPanel} px-3 py-2 text-xs ${cx.textFaint}`}>
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#089981] opacity-40" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#089981]" />
                                </span>
                                Auto update: 1 sec
                            </div>

                            <button
                                type="button"
                                onClick={onRefresh}
                                className={`inline-flex h-9 items-center gap-2 rounded-md border ${cx.border} ${cx.bgPanel} px-3 text-xs font-medium ${cx.textMuted} hover:bg-white/[0.06]`}
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                                Refresh
                            </button>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="mb-5 rounded-md border border-[#f23645]/25 bg-[#f23645]/[0.07] px-4 py-3">
                        <p className="text-sm font-medium text-[#f23645]">{error}</p>
                    </div>
                )}

                {loading ? (
                    <div className="flex min-h-[500px] items-center justify-center">
                        <div className="text-center">
                            <RefreshCw className={`mx-auto h-6 w-6 animate-spin ${cx.textMuted}`} />
                            <p className={`mt-3 text-sm ${cx.textMuted}`}>Loading instrument data...</p>
                        </div>
                    </div>
                ) : !latestQuote ? (
                    <div className={`rounded-md border ${cx.border} ${cx.bgPanel} p-12 text-center`}>
                        <Activity className={`mx-auto h-7 w-7 ${cx.textFaint}`} />
                        <h2 className="mt-4 text-sm font-medium text-slate-300">No data found</h2>
                        <p className={`mt-1 text-xs ${cx.textFaint}`}>No matching data was returned by the API.</p>
                    </div>
                ) : (
                    children
                )}
            </div>
        </main>
    );
}
