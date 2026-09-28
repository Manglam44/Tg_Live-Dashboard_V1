import { Activity, CircleDollarSign, Settings2, TrendingUp } from "lucide-react";
import type { MarketQuote } from "@/lib/types";
import { formatNumber } from "@/lib/dashboard/format";
import { cx } from "@/lib/dashboard/theme";

export function getInstrumentIcon(type: MarketQuote["instrument_type"]) {
    switch (type) {
        case "future":
            return TrendingUp;
        case "option":
            return Settings2;
        case "spot":
            return CircleDollarSign;
        default:
            return Activity;
    }
}

export function Badge({
    children,
    variant = "default",
}: {
    children: React.ReactNode;
    variant?: "default" | "live" | "delayed" | "future" | "option" | "spot";
}) {
    const classes: Record<string, string> = {
        default: `${cx.border} ${cx.bgPanelSoft} ${cx.textMuted}`,
        live: "border-[#089981]/30 bg-[#089981]/10 text-[#089981]",
        delayed: "border-[#f0a30a]/30 bg-[#f0a30a]/10 text-[#f0a30a]",
        future: "border-[#2962ff]/30 bg-[#2962ff]/10 text-[#5b8dff]",
        option: "border-violet-400/25 bg-violet-400/10 text-violet-300",
        spot: "border-[#f0a30a]/30 bg-[#f0a30a]/10 text-[#f0a30a]",
    };

    return (
        <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${classes[variant]}`}>
            {children}
        </span>
    );
}

export function PriceValue({ value, decimals = 4 }: { value: number | null | undefined; decimals?: number }) {
    return <span className={`font-mono text-sm font-medium tabular-nums ${cx.textPrimary}`}>{formatNumber(value, decimals)}</span>;
}

export function SummaryCard({
    title,
    value,
    icon: Icon,
    description,
}: {
    title: string;
    value: number;
    icon: React.ElementType;
    description: string;
}) {
    return (
        <div className={`rounded-md border ${cx.border} ${cx.bgPanel} p-4`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className={`text-[11px] font-medium uppercase tracking-wide ${cx.textFaint}`}>{title}</p>
                    <p className={`mt-2 text-2xl font-semibold ${cx.textPrimary}`}>{value}</p>
                    <p className={`mt-1 text-xs ${cx.textFaint}`}>{description}</p>
                </div>

                <div className={`rounded-md border ${cx.borderSoft} ${cx.bgPanelSoft} p-2`}>
                    <Icon className={`h-4 w-4 ${cx.textMuted}`} />
                </div>
            </div>
        </div>
    );
}
