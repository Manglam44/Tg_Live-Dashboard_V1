import type { MarketQuote } from "@/lib/types";

export function formatNumber(value: number | null | undefined, decimals = 4) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";

    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
    }).format(value);
}

export function formatSize(value: number | null | undefined) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";

    if (Math.abs(value) >= 1_000_000) return `${formatNumber(value / 1_000_000, 2)}M`;
    if (Math.abs(value) >= 1_000) return `${formatNumber(value / 1_000, 2)}K`;

    return formatNumber(value, 2);
}

export function formatExpiry(expiry: string | number | null | undefined) {
    if (!expiry) return "—";

    const value = String(expiry);
    if (!/^\d{8}$/.test(value)) return value;

    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    const date = new Date(year, month, day);

    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatTime(value: string | null | undefined) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleTimeString("en-IN", {
        day: "2-digit",
        month: "short",
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

/** Full date + time, for detail screens where the day matters (unlike the dashboard's HH:MM:SS). */
export function formatDateTime(value: string | null | undefined) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

export function instrumentLabel(type: MarketQuote["instrument_type"]) {
    switch (type) {
        case "future":
            return "Future";
        case "option":
            return "Option";
        case "spot":
            return "Spot";
        default:
            return type || "—";
    }
}
