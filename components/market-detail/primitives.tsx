import { cx } from "@/lib/dashboard/theme";
import { formatNumber } from "@/lib/dashboard/format";

export function DetailItem({
    label,
    value,
    mono = false,
}: {
    label: string;
    value: React.ReactNode;
    mono?: boolean;
}) {
    return (
        <div className={`rounded-md border ${cx.borderSoft} ${cx.bgPanel} p-4`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${cx.textFaint}`}>{label}</p>
            <p className={`mt-2 text-sm font-medium text-slate-200 ${mono ? "font-mono tabular-nums" : ""}`}>
                {value ?? "—"}
            </p>
        </div>
    );
}

export function PriceCard({
    label,
    value,
    decimals,
    tone = "default",
}: {
    label: string;
    value: number | null | undefined;
    decimals: number;
    tone?: "default" | "up" | "down";
}) {
    const toneClass = tone === "up" ? cx.up : tone === "down" ? cx.down : "text-white";

    return (
        <div className={`rounded-md border ${cx.border} ${cx.bgPanel} p-5`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${cx.textFaint}`}>{label}</p>
            <p className={`mt-3 font-mono text-2xl font-semibold tabular-nums ${toneClass}`}>
                {formatNumber(value, decimals)}
            </p>
        </div>
    );
}
