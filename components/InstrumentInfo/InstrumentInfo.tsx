import styles from "@/components/TradingChart/Instrumentinfo.module.css";

export type InstrumentDetails = {
    symbol: string;
    name?: string | null;
    assetClass?: string | null;
    instrumentType?: string | null;
    exchange?: string | null;
    underlying?: string | null;
    expiry?: string | null; // YYYYMMDD
    strike?: string | null;
    right?: string | null;
    mode?: string | null;
};

const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : null);

/** "20270127" -> "27 Jan 2027 (112 days left)" */
function fmtExpiry(e?: string | null) {
    if (!e) return null;
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(e);
    if (!m) return e;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    const text = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
    const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
    return days < 0 ? `${text} (expired)` : `${text} (${days} day${days === 1 ? "" : "s"} left)`;
}

type Props = InstrumentDetails & { theme?: "dark" | "light" };

/** Presentational: shows whatever details it is given (e.g. from the URL search params). */
export default function InstrumentInfo({ theme = "dark", ...d }: Props) {
    const mode = d.mode?.toUpperCase() ?? null;

    const details: [string, string | null][] = [
        ["Name", d.name ?? null],
        ["Symbol", d.symbol],
        ["Asset class", cap(d.assetClass)],
        ["Instrument type", cap(d.instrumentType)],
        ["Exchange", d.exchange ?? null],
        ["Underlying", d.underlying ?? null],
        ["Contract expiry", fmtExpiry(d.expiry)],
        ["Strike", d.strike ?? null],
        ["Option right", d.right ?? null],
        ["Feed mode", mode],
    ];

    return (
        <section className={styles.panel} data-theme={theme} aria-labelledby="instrument-title">
            <header className={styles.head}>
                <div>
                    <h1 id="instrument-title" className={styles.title}>{d.name || d.symbol}</h1>
                    <div className={styles.badges}>
                        <span className={styles.badge}>{d.symbol}</span>
                        {d.exchange && <span className={styles.badge}>{d.exchange}</span>}
                        {d.instrumentType && <span className={styles.badge}>{cap(d.instrumentType)}</span>}
                        {mode && <span className={mode === "LIVE" ? styles.liveBadge : styles.badge}>{mode}</span>}
                    </div>
                </div>
            </header>

            <dl className={styles.grid}>
                {details
                    .filter(([, v]) => v != null && v !== "")
                    .map(([label, value]) => (
                        <div key={label} className={styles.item}>
                            <dt className={styles.label}>{label}</dt>
                            <dd className={styles.dd}>{value}</dd>
                        </div>
                    ))}
            </dl>
        </section>
    );
}