/**
 * Color tokens modeled on TradingView's dark theme (in.tradingview.com/markets).
 * Kept as plain hex + Tailwind arbitrary-value classes so any component can
 * reuse them without depending on a Tailwind config change.
 */
export const theme = {
    bgApp: "#131722",
    bgPanel: "#1c2030",
    bgPanelSoft: "#1a1e2b",
    border: "#2a2e39",
    borderSoft: "#242835",
    textPrimary: "#d1d4dc",
    textMuted: "#787b86",
    textFaint: "#5d606b",
    accent: "#2962ff",
    up: "#089981", // TradingView's bullish teal-green
    down: "#f23645", // TradingView's bearish red
    warn: "#f0a30a",
} as const;

export const cx = {
    page: "min-h-screen text-[15px]",
    panel: "rounded-md border",
    // Tailwind can't read dynamic hex from the object above at build time
    // for every utility, so the frequently-used combinations are spelled
    // out here once and reused everywhere.
    bgApp: "bg-[#131722]",
    bgPanel: "bg-[#1c2030]",
    bgPanelSoft: "bg-[#1a1e2b]",
    border: "border-[#2a2e39]",
    borderSoft: "border-[#242835]",
    textPrimary: "text-[#d1d4dc]",
    textMuted: "text-[#787b86]",
    textFaint: "text-[#5d606b]",
    accentText: "text-[#2962ff]",
    accentBg: "bg-[#2962ff]",
    up: "text-[#089981]",
    upBg: "bg-[#089981]",
    down: "text-[#f23645]",
    downBg: "bg-[#f23645]",
    warnText: "text-[#f0a30a]",
    warnBg: "bg-[#f0a30a]",
};
