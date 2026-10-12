"use client";

import {
    Activity,
    BarChart3,
    Flame, Layers,
    LineChart,
    LogOut, Moon,
    RefreshCw,
    Search,
    Sun,
    Zap
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import TradingChart from "@/components/TradingChart/TradingChart";
import { useLiveCandle } from "@/hooks/useLiveCandle";
import { useMarketQuotes } from "@/hooks/useMarketQuotes";
import { normalizeCandles, type Candle, type Interval, type RawRow } from "@/lib/chart-data";
import { COMMODITY_ORDER } from "@/lib/dashboard/constants";
import { formatSize } from "@/lib/dashboard/format";
import type { MarketQuote } from "@/lib/types";
import { displaySymbol, keyOf } from "@/lib/types";

/* ================================================================
 * Types & category config
 * ================================================================ */
type Theme = "dark" | "light";
type Category = "all" | "energy" | "metals" | "agriculture" | "softs" | "livestock" | "other";

const CATEGORY_MAP: Record<Exclude<Category, "all" | "other">, string[]> = {
    energy: ["CL", "BZ", "NG", "HO", "RB"],
    metals: ["GC", "SI", "HG", "PL", "PA"],
    agriculture: ["ZC", "ZS", "ZW", "ZM", "ZL", "KE", "MWE"],
    softs: ["KC", "SB", "CC", "CT", "OJ"],
    livestock: ["LE", "HE", "GF"],
};
const CATEGORY_META: Record<Category, { label: string; icon: typeof Flame; color: string }> = {
    all: { label: "All", icon: Layers, color: "#787b86" },
    energy: { label: "Energy", icon: Flame, color: "#f5a623" },
    metals: { label: "Metals", icon: Zap, color: "#4c8dff" },
    agriculture: { label: "Agri", icon: Activity, color: "#089981" },
    softs: { label: "Softs", icon: LineChart, color: "#b48cff" },
    livestock: { label: "Livestock", icon: BarChart3, color: "#f23645" },
    other: { label: "Other", icon: Layers, color: "#787b86" },
};
const PILLS: Category[] = ["all", "metals", "agriculture"];

function getCategory(symbol?: string | null): Category {
    const s = symbol?.toUpperCase();
    if (!s) return "other";
    for (const [cat, list] of Object.entries(CATEGORY_MAP)) if (list.includes(s)) return cat as Category;
    return "other";
}

/* ================================================================
 * Contract month helpers
 * ================================================================ */
const MONTH_CODES = "FGHJKMNQUVXZ";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function contractInfo(expiry?: string | null) {
    const s = (expiry ?? "").replace(/\D/g, "");
    if (s.length < 6) return null;
    const y = Number(s.slice(0, 4));
    const m = Number(s.slice(4, 6));
    if (!y || m < 1 || m > 12) return null;
    const d = s.length >= 8 ? Number(s.slice(6, 8)) : null;
    return {
        long: `${MONTHS[m - 1]} ${y}`,
        short: `${MONTHS[m - 1]} ${String(y).slice(-2)}`,
        code: `${MONTH_CODES[m - 1]}${String(y).slice(-2)}`,
        date: d ? `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}` : null,
    };
}

/* ================================================================
 * Enrichment
 * ================================================================ */
type EnrichedQuote = MarketQuote & {
    _change: number | null; _changePct: number | null; _prev: number | null;
    _open: number | null; _high: number | null; _low: number | null; _volume: number | null;
};
// Accepts real numbers AND numeric strings ("-45.4", "1,234.5") — feeds/Postgres often send strings.
const num = (v: unknown): number | null => {
    if (typeof v === "number") return isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v.replace(/,/g, "").replace(/%$/, ""));
        return isFinite(n) ? n : null;
    }
    return null;
};

/** Session stats from /api/market/stats (feed has no open/high/low/prev close/volume). */
type SessionStat = {
    open: number | null; high: number | null; low: number | null; volume: number | null; prev: number | null;
};

function enrichQuote(q: MarketQuote, st?: SessionStat): EnrichedQuote {
    // case / underscore-insensitive field lookup: prev_close, prevClose, PrevClose -> "prevclose"
    const norm = new Map<string, unknown>();
    for (const [k, v] of Object.entries(q as unknown as Record<string, unknown>))
        norm.set(k.toLowerCase().replace(/[^a-z0-9]/g, ""), v);
    const pick = (...keys: string[]) => {
        for (const k of keys) {
            const n = num(norm.get(k));
            if (n != null) return n;
        }
        return null;
    };

    const last = num(q.last);
    const prev = pick("prevclose", "previousclose", "prevsettle", "prevsettlement", "previoussettlement",
        "priorsettle", "settlement", "settle", "settlementprice", "close") ?? st?.prev ?? null;
    const change = pick("change", "netchange", "netchg", "chg", "pricechange", "changevalue", "diff")
        ?? (last != null && prev != null ? last - prev : null);
    const pct = pick("changepct", "pctchange", "changepercent", "percentchange", "pchange", "chgpct", "netchangepct", "changepercentage")
        ?? (change != null && prev ? (change / prev) * 100 : null);

    // live price extends the stored session high / low between refreshes
    const hi = pick("high", "dayhigh", "highprice") ?? st?.high ?? null;
    const lo = pick("low", "daylow", "lowprice") ?? st?.low ?? null;
    return {
        ...q, _change: change, _changePct: pct, _prev: prev,
        _open: pick("open", "openprice", "dayopen") ?? st?.open ?? null,
        _high: hi != null && last != null ? Math.max(hi, last) : hi,
        _low: lo != null && last != null ? Math.min(lo, last) : lo,
        _volume: pick("volume", "vol", "totalvolume", "dayvolume") ?? st?.volume ?? null,
    };
}

const DECIMALS = 2;
const fmtNum = (v: number | null | undefined, d: number) =>
    v == null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const IST_FMT = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
});
/** quote_time carries the correct offset. ticker_time is UTC mislabelled "+05:30", so reinterpret it as UTC. */
function quoteInstant(q: MarketQuote): Date | null {
    const a = q as unknown as Record<string, unknown>;
    let d: Date | null = null;
    if (typeof a.quote_time === "string") d = new Date(a.quote_time);
    else if (typeof a.ticker_time === "string")
        d = new Date(a.ticker_time.replace(/([+-]\d{2}:\d{2}|Z)$/, "") + "Z");
    return d && !isNaN(d.getTime()) ? d : null;
}
const fmtIst = (d: Date | null) => (d ? IST_FMT.format(d) : "—");
const signOf = (c: number | null) => (c == null || c === 0 ? "" : c > 0 ? "+" : "−");

/* ================================================================
 * Theme (TradingView palette)
 * ================================================================ */
const THEME_CSS = `
.mt-root[data-theme="dark"]{
  --app:#131722; --panel:#131722; --panel-soft:#1e222d; --head:#1e222d;
  --border:#2a2e39; --border-soft:rgba(42,46,57,.55);
  --text:#d1d4dc; --muted:#b2b5be; --faint:#787b86; --hover:rgba(42,46,57,.7);
  --up:#089981; --down:#f23645; --flat:#787b86; --accent:#2962ff;
}
.mt-root[data-theme="light"]{
  --app:#ffffff; --panel:#ffffff; --panel-soft:#f8f9fd; --head:#f8f9fd;
  --border:#e0e3eb; --border-soft:#eef0f5;
  --text:#131722; --muted:#434651; --faint:#787b86; --hover:#f0f3fa;
  --up:#089981; --down:#f23645; --flat:#787b86; --accent:#2962ff;
}
.mt-root{background:var(--app);color:var(--text)}
.mt-scroll{scrollbar-width:thin;scrollbar-color:var(--border) transparent}
`;
const tint = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const dirColor = (c: number | null) => (c == null || c === 0 ? "var(--flat)" : c > 0 ? "var(--up)" : "var(--down)");

/* ================================================================
 * Chart (left)
 * ================================================================ */
function ChartPanel({ quote, theme, onThemeChange }: {
    quote: EnrichedQuote; theme: Theme; onThemeChange: (t: Theme) => void;
}) {
    const symbol = quote.symbol ?? "";
    const info = contractInfo(quote.expiry);
    const title = `${quote.name || symbol}${info ? ` · ${info.long}` : ""}`;
    const expiry = quote.expiry && /^\d{8}$/.test(quote.expiry) ? quote.expiry : null; // API expects YYYYMMDD

    const [interval, setIntervalTf] = useState<Interval>("1D");
    const [contract, setContract] = useState<string | null>(null);
    const [data, setData] = useState<Candle[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // history: refetch when contract or interval changes
    useEffect(() => {
        if (!symbol) return;
        let cancelled = false;
        setError(null);
        setData([]);
        setContract(null);
        setLoading(true);

        const params = new URLSearchParams({ symbol, interval });
        if (expiry) params.set("expiry", expiry);

        fetch(`/api/candles?${params}`)
            .then(async (r) => {
                if (!r.ok) {
                    const body = await r.json().catch(() => ({}));
                    throw new Error(body.detail ?? body.error ?? `HTTP ${r.status}`);
                }
                if (!cancelled) setContract(r.headers.get("x-contract-expiry"));
                return r.json();
            })
            .then((rows: RawRow[]) => !cancelled && setData(normalizeCandles(rows)))
            .catch((e: Error) => !cancelled && setError(e.message))
            .finally(() => !cancelled && setLoading(false));

        return () => { cancelled = true; };
    }, [symbol, expiry, interval]);

    // realtime candle for the same symbol / interval / contract
    const { liveBar, status } = useLiveCandle({
        symbol, interval, expiry: expiry ?? contract, enabled: data.length > 0,
    });

    return (
        <div className="relative h-full min-h-0">
            {loading && (
                <div className="absolute right-4 top-14 z-10 text-[var(--faint)]">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                </div>
            )}
            {error && (
                <p role="alert" className="absolute bottom-3 left-3 z-10 max-w-[80%] rounded px-3 py-2 text-xs"
                    style={{ color: "var(--down)", background: tint("var(--down)", 14) }}>
                    Could not load chart data: {error}
                </p>
            )}
            <TradingChart
                key={`${symbol}-${expiry ?? "spot"}`}
                symbol={title}
                data={data}
                interval={interval}
                onIntervalChange={setIntervalTf}
                liveBar={liveBar}
                liveStatus={status}
                theme={theme}
                onThemeChange={onThemeChange}
                height="100%"
            />
        </div>
    );
}

/* ================================================================
 * Watchlist row
 * ================================================================ */
const COLS = "grid-cols-[minmax(0,1fr)_76px_62px_66px]";

function WatchRow({ quote, selected, onSelect }: { quote: EnrichedQuote; selected: boolean; onSelect: () => void }) {
    const info = contractInfo(quote.expiry);
    const cat = CATEGORY_META[getCategory(quote.symbol)];
    const c = dirColor(quote._change);
    const s = signOf(quote._change);
    const name = quote.name || quote.underlying || displaySymbol(quote).toString();
    const sub = [quote.symbol, info?.code, quote.exchange].filter(Boolean).join(" · ");

    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={`grid w-full ${COLS} items-center gap-2 border-b border-[var(--border-soft)] px-3 py-1.5 text-left transition hover:bg-[var(--hover)]`}
            style={selected ? { background: tint("var(--accent)", 14), boxShadow: "inset 0 0 0 1px var(--accent)" } : undefined}
        >
            <div className="flex min-w-0 items-center gap-2.5">
                <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ color: cat.color, background: tint(cat.color, 20) }}
                >
                    {(quote.symbol ?? "?").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                    <p className="flex items-baseline gap-1.5 text-[13px] font-semibold leading-tight">
                        <span className="truncate uppercase">{name}</span>
                        <span className="shrink-0 text-[11px] font-medium text-[var(--faint)]">
                            {info ? info.short : quote.expiry || ""}
                        </span>
                    </p>
                    <p className="truncate text-[10px] text-[var(--faint)]">{sub}</p>
                </div>
            </div>

            <span className="text-right font-mono text-[13px] font-medium tabular-nums" style={{ color: c }}>
                {fmtNum(quote.last, DECIMALS)}
            </span>
            <span className="text-right font-mono text-[12px] tabular-nums" style={{ color: c }}>
                {quote._change == null ? "—" : `${s}${fmtNum(Math.abs(quote._change), DECIMALS)}`}
            </span>
            <span className="text-right font-mono text-[12px] tabular-nums" style={{ color: c }}>
                {quote._changePct == null ? "—" : `${s}${Math.abs(quote._changePct).toFixed(2)}%`}
            </span>
        </button>
    );
}

/* ================================================================
 * Selected contract details (bottom 40%)
 * ================================================================ */
function Row({ k, v, color }: { k: string; v: string; color?: string }) {
    return (
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] py-1.5">
            <span className="text-[12px] text-[var(--faint)]">{k}</span>
            <span className="font-mono text-[12px] font-medium tabular-nums" style={{ color }}>{v}</span>
        </div>
    );
}

function Details({ q, feedDown }: { q: EnrichedQuote; feedDown: boolean }) {
    const info = contractInfo(q.expiry);
    const d = DECIMALS;
    const cat = CATEGORY_META[getCategory(q.symbol)];
    const c = dirColor(q._change);
    const s = signOf(q._change);
    const name = q.name || q.underlying || displaySymbol(q).toString();
    const type = (q.instrument_type ?? "future").toUpperCase();
    const pos =
        q._low != null && q._high != null && q.last != null && q._high > q._low
            ? Math.max(0, Math.min(100, ((q.last - q._low) / (q._high - q._low)) * 100))
            : null;

    return (
        <div className="px-4 py-3">
            <div className="flex items-center gap-3">
                <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ color: cat.color, background: tint(cat.color, 20) }}
                >
                    {(q.symbol ?? "?").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold uppercase leading-tight">
                        {name}{info ? ` · ${info.short}` : ""}
                    </p>
                    <p className="truncate text-[11px] text-[var(--faint)]">
                        {[q.symbol, info?.long, q.exchange, type].filter(Boolean).join(" · ")}
                    </p>
                </div>
            </div>

            <div className="mt-3 flex items-baseline gap-3">
                <span className="font-mono text-[28px] font-semibold leading-none tabular-nums">{fmtNum(q.last, d)}</span>
                <span className="font-mono text-[14px] font-medium tabular-nums" style={{ color: c }}>
                    {q._change == null ? "—" : `${s}${fmtNum(Math.abs(q._change), d)}`}
                    {q._changePct != null && <> &nbsp;{s}{Math.abs(q._changePct).toFixed(2)}%</>}
                </span>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--faint)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: feedDown ? "var(--down)" : "var(--up)" }} />
                {feedDown ? "Feed down" : "Live"} · Last update at {fmtIst(quoteInstant(q))} IST
            </p>

            {pos != null && (
                <div className="mt-3">
                    <div className="relative h-1 rounded-full bg-[var(--border)]">
                        <span
                            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--panel)] bg-[var(--accent)]"
                            style={{ left: `${pos}%` }}
                        />
                    </div>
                    <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)] tabular-nums">
                        <span>{fmtNum(q._low, d)}</span><span>Day range</span><span>{fmtNum(q._high, d)}</span>
                    </div>
                </div>
            )}

            <div className="mt-2 grid grid-cols-2 gap-x-6">
                <Row k="Bid" v={fmtNum(q.bid, d)} />
                <Row k="Ask" v={fmtNum(q.ask, d)} />
                <Row k="Bid size" v={formatSize(q.bid_size)} />
                <Row k="Ask size" v={formatSize(q.ask_size)} />
                <Row k="Open" v={fmtNum(q._open, d)} />
                <Row k="Prev close" v={fmtNum(q._prev, d)} />
                <Row k="Day high" v={fmtNum(q._high, d)} color="var(--up)" />
                <Row k="Day low" v={fmtNum(q._low, d)} color="var(--down)" />
                <Row k="Volume" v={q._volume == null ? "—" : formatSize(q._volume)} />
                <Row k="Expiry" v={info?.date ?? q.expiry ?? "—"} />
            </div>
        </div>
    );
}

/* ================================================================
 * Main dashboard (commodities only)
 * ================================================================ */
export default function MarketDashboard() {
    const router = useRouter();

    const [theme, setTheme] = useState<Theme>("dark");
    const [category, setCategory] = useState<Category>("all");
    const [query, setQuery] = useState("");
    const [selectedKey, setSelectedKey] = useState<string | null>(null);

    useEffect(() => {
        try {
            const saved = localStorage.getItem("mt-theme") as Theme | null;
            if (saved === "dark" || saved === "light") return setTheme(saved);
            if (window.matchMedia("(prefers-color-scheme: light)").matches) setTheme("light");
        } catch { /* storage unavailable */ }
    }, []);
    const chooseTheme = useCallback((t: Theme) => {
        setTheme(t);
        try { localStorage.setItem("mt-theme", t); } catch { /* ignore */ }
    }, []);

    const commodity = useMarketQuotes("/api/market/commodity", "live", COMMODITY_ORDER);

    // session stats (open / high / low / prev close / volume) from QuestDB, refreshed every 10s
    const [stats, setStats] = useState<Record<string, SessionStat>>({});
    useEffect(() => {
        let stop = false;
        const load = async () => {
            try {
                const r = await fetch("/api/market/stats", { cache: "no-store" });
                if (!r.ok) return;
                const j = await r.json();
                if (!stop) setStats(j.stats ?? {});
            } catch { /* keep previous stats */ }
        };
        void load();
        const id = setInterval(load, 10_000);
        return () => { stop = true; clearInterval(id); };
    }, []);

    const enriched = useMemo(
        () => commodity.quotes.map((q) => enrichQuote(q, stats[`${q.symbol}|${q.expiry}`])),
        [commodity.quotes, stats],
    );

    // Flat list: fixed commodity order, contracts nearest-expiry first
    const rows = useMemo(() => {
        const search = query.trim().toLowerCase();
        const orderSrc = COMMODITY_ORDER as unknown as Array<string | { symbol?: string }>;
        const order = new Map<string, number>();
        orderSrc.forEach((o, i) => order.set(String(typeof o === "string" ? o : o?.symbol ?? "").toUpperCase(), i));
        const rank = (sym?: string | null) => order.get((sym ?? "").toUpperCase()) ?? Number.MAX_SAFE_INTEGER;

        return enriched
            .filter((q) => {
                if (q.instrument_type?.toLowerCase() !== "future") return false;
                if (category !== "all" && getCategory(q.symbol) !== category) return false;
                if (!search) return true;
                return [displaySymbol(q), q.name, q.symbol, q.pair, q.exchange, q.underlying, q.expiry, contractInfo(q.expiry)?.long]
                    .filter(Boolean).join(" ").toLowerCase().includes(search);
            })
            .sort((a, b) =>
                rank(a.symbol) - rank(b.symbol) ||
                (a.name ?? "").localeCompare(b.name ?? "") ||
                (a.expiry ?? "").localeCompare(b.expiry ?? ""));
    }, [enriched, category, query]);

    const selected = useMemo(() => enriched.find((q) => keyOf(q) === selectedKey) ?? null, [enriched, selectedKey]);

    useEffect(() => {
        if (selected || !rows.length) return;
        setSelectedKey(keyOf(rows[0]));
    }, [selected, rows]);

    const handleLogout = () => {
        document.cookie = "market_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        router.replace("/login");
        router.refresh();
    };

    const feedDown = Boolean(commodity.liveDataDown);

    return (
        <main data-theme={theme} className="mt-root flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
            <style jsx global>{THEME_CSS}</style>

            {/* ================= TOP BAR ================= */}
            <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
                <div className="flex items-center gap-2.5">
                    <BarChart3 className="h-5 w-5 text-[var(--accent)]" />
                    <h1 className="text-[15px] font-semibold tracking-tight">TransGraph Live Quotes</h1>
                </div>
                <div className="flex items-center gap-2">
                    <span
                        className="flex h-8 items-center gap-2 rounded px-2.5 text-xs font-semibold"
                        style={{ color: feedDown ? "var(--down)" : "var(--up)", background: tint(feedDown ? "var(--down)" : "var(--up)", 14) }}
                        role="status"
                    >
                        <span className="relative flex h-2 w-2">
                            {!feedDown && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--up)] opacity-50" />}
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                        </span>
                        {feedDown ? "Feed down" : "Live"}
                    </span>
                    <div className="inline-flex h-8 items-center rounded border border-[var(--border)] p-0.5" role="group" aria-label="Theme">
                        {(["dark", "light"] as const).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => chooseTheme(t)}
                                aria-pressed={theme === t}
                                title={`${t} theme`}
                                className="flex h-7 w-7 items-center justify-center rounded transition"
                                style={theme === t ? { background: tint("var(--accent)", 18), color: "var(--accent)" } : { color: "var(--faint)" }}
                            >
                                {t === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={handleLogout}
                        className="inline-flex h-8 items-center gap-1.5 rounded border border-[var(--border)] px-2.5 text-xs font-medium text-[var(--down)] transition hover:bg-[var(--hover)]">
                        <LogOut className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Sign out</span>
                    </button>
                </div>
            </header>

            {/* ================= BODY ================= */}
            <div className="grid min-h-0 flex-1 grid-rows-[65vh_95vh] lg:grid-cols-[minmax(0,1fr)_440px] lg:grid-rows-1">
                {/* ---------- LEFT: chart ---------- */}
                <section className="min-h-0 min-w-0 border-[var(--border)] lg:border-r">
                    {selected ? (
                        <ChartPanel quote={selected} theme={theme} onThemeChange={chooseTheme} />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center text-center">
                            <LineChart className="mb-3 h-6 w-6 text-[var(--faint)]" />
                            <p className="text-sm font-medium">Select a contract</p>
                            <p className="mt-1 text-xs text-[var(--faint)]">Pick an expiry from the list to open its live chart.</p>
                        </div>
                    )}
                </section>

                {/* ---------- RIGHT: watchlist (60%) + details (40%) ---------- */}
                <aside className="flex min-h-0 flex-col border-t border-[var(--border)] lg:border-t-0">
                    {/* 60% — heading + listing */}
                    <div className="flex h-[60%] min-h-0 flex-col border-b border-[var(--border)]">
                        <div className="shrink-0 space-y-2 px-3 pb-2 pt-3">
                            <div className="relative min-w-0">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--faint)]" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search..."
                                    className="h-8 w-full rounded border border-[var(--border)] bg-[var(--panel-soft)] pl-8 pr-2 text-xs outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
                                />
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {PILLS.map((cat) => {
                                    const on = category === cat;
                                    return (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setCategory(cat)}
                                            className="h-6 rounded-full px-2.5 text-[11px] font-medium transition"
                                            style={on
                                                ? { background: "var(--accent)", color: "#fff" }
                                                : { background: "var(--panel-soft)", color: "var(--muted)" }}
                                        >
                                            {CATEGORY_META[cat].label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className={`grid ${COLS} shrink-0 gap-2 border-y border-[var(--border)] bg-[var(--head)] px-3 py-1.5 text-[11px] font-semibold text-[var(--faint)]`}>
                            <span>Symbol <span className="font-normal">· {rows.length}</span></span>
                            <span className="text-right">Last</span>
                            <span className="text-right">Chg</span>
                            <span className="text-right">Chg%</span>
                        </div>

                        {commodity.error && (
                            <p className="shrink-0 px-3 py-1.5 text-xs text-[var(--down)]">Market data error: {commodity.error}</p>
                        )}

                        <div className="mt-scroll min-h-0 flex-1 overflow-y-auto">
                            {commodity.loading ? (
                                <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2">
                                    <RefreshCw className="h-5 w-5 animate-spin text-[var(--faint)]" />
                                    <p className="text-xs text-[var(--faint)]">Loading market data...</p>
                                </div>
                            ) : rows.length === 0 ? (
                                <div className="flex h-full min-h-[160px] flex-col items-center justify-center text-center">
                                    <Search className="mb-2 h-5 w-5 text-[var(--faint)]" />
                                    <p className="text-sm font-medium">No instruments found</p>
                                    <p className="mt-1 text-xs text-[var(--faint)]">Change the category or clear the search.</p>
                                </div>
                            ) : (
                                rows.map((q) => (
                                    <WatchRow key={keyOf(q)} quote={q} selected={keyOf(q) === selectedKey} onSelect={() => setSelectedKey(keyOf(q))} />
                                ))
                            )}
                        </div>
                    </div>

                    {/* 40% — selected contract */}
                    <div className="mt-scroll h-[40%] min-h-0 overflow-y-auto bg-[var(--panel)]">
                        {selected ? (
                            <Details q={selected} feedDown={feedDown} />
                        ) : (
                            <p className="p-4 text-xs text-[var(--faint)]">Select a contract to see its details.</p>
                        )}
                    </div>
                </aside>
            </div>
        </main>
    );
}