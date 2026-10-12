"use client";

import { useEffect, useRef, useState } from "react";
import { INTERVAL_META, type Interval } from "../../lib/chart-data";
import styles from "./IntervalMenu.module.css";

const SECTIONS = [
    { group: "minutes", title: "Minutes" },
    { group: "days", title: "Days" },
] as const;

type Props = {
    value: Interval;
    intervals: readonly Interval[];
    onChange?: (i: Interval) => void;
};

/** TradingView-style timeframe dropdown: current value button + Minutes / Days sections. */
export default function IntervalMenu({ value, intervals, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const down = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", down);
        document.addEventListener("keydown", key);
        return () => {
            document.removeEventListener("mousedown", down);
            document.removeEventListener("keydown", key);
        };
    }, [open]);

    return (
        <div ref={ref} className={styles.root}>
            <button
                type="button"
                className={`${styles.trigger} ${open ? styles.open : ""}`}
                aria-haspopup="listbox"
                aria-expanded={open}
                title="Timeframe"
                onClick={() => setOpen((o) => !o)}
            >
                {INTERVAL_META[value].short}
            </button>

            {open && (
                <div className={styles.menu} role="listbox" aria-label="Timeframe">
                    {SECTIONS.map(({ group, title }) => {
                        const items = intervals.filter((i) => INTERVAL_META[i].group === group);
                        if (!items.length) return null;
                        return (
                            <div key={group} className={styles.section}>
                                <p className={styles.title}>{title}</p>
                                {items.map((i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        role="option"
                                        aria-selected={i === value}
                                        className={`${styles.item} ${i === value ? styles.selected : ""}`}
                                        onClick={() => {
                                            onChange?.(i);
                                            setOpen(false);
                                        }}
                                    >
                                        {INTERVAL_META[i].label}
                                    </button>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}