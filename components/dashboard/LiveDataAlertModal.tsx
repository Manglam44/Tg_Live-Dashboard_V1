"use client";

import { AlertTriangle, X } from "lucide-react";
import { cx } from "@/lib/dashboard/theme";

interface LiveDataAlertModalProps {
    open: boolean;
    onSwitchToDelayed: () => void;
    onRetry: () => void;
    onDismiss: () => void;
}

export function LiveDataAlertModal({ open, onSwitchToDelayed, onRetry, onDismiss }: LiveDataAlertModalProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div
                className={`w-full max-w-md rounded-lg border ${cx.border} ${cx.bgPanel} p-5 shadow-2xl`}
                role="alertdialog"
                aria-labelledby="live-data-alert-title"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${cx.warnBg}/10`}>
                            <AlertTriangle className={`h-4.5 w-4.5 ${cx.warnText}`} />
                        </div>

                        <div>
                            <h2 id="live-data-alert-title" className={`text-sm font-semibold ${cx.textPrimary}`}>
                                Live prices aren&apos;t updating
                            </h2>

                            <p className={`mt-1.5 text-xs leading-relaxed ${cx.textMuted}`}>
                                We haven&apos;t received a fresh tick from the live feed for a while. Prices on
                                screen may no longer reflect the market. You can keep watching for the feed
                                to recover, or switch to delayed quotes so it&apos;s clear the data isn&apos;t live.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onDismiss}
                        aria-label="Dismiss"
                        className={`shrink-0 rounded-md p-1 ${cx.textFaint} hover:text-slate-200`}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onRetry}
                        className={`h-9 rounded-md border ${cx.border} px-3 text-xs font-medium ${cx.textPrimary} transition hover:bg-white/5`}
                    >
                        Retry now
                    </button>

                    <button
                        type="button"
                        onClick={onSwitchToDelayed}
                        className={`h-9 rounded-md px-3 text-xs font-semibold text-white transition ${cx.accentBg} hover:opacity-90`}
                    >
                        Switch to delayed quotes
                    </button>
                </div>
            </div>
        </div>
    );
}
