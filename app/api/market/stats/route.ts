import { NextResponse } from "next/server";
import { questdb } from "@/lib/questdb";
import { TABLE, TS_COL } from "@/lib/candle-sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Session stats per contract, computed from your tick history because the live feed
 * has no open / high / low / previous close / volume.
 *
 *  - Session = the IST day containing the newest tick (so weekends show Friday's session).
 *  - prev    = last price BEFORE the session started (used for Change and Chg%).
 *  - Set SESSION_START_IST_MIN in .env.local to move the session start (minutes after
 *    IST midnight, e.g. 0 = 12:00 am IST).
 *  - volume  = number of quotes in the session (tick volume), same as the chart.
 */
const IST_MS = 330 * 60_000;
const DAY = 86_400_000;
const SESSION_START_MS = Number(process.env.SESSION_START_IST_MIN ?? 0) * 60_000;

type Cache = { at: number; body: unknown };
const g = globalThis as unknown as { __statsCache?: Cache; __prevCache?: { day: number; map: Record<string, number> } };

const num = (v: unknown) => {
    const n = Number(v);
    return v == null || !Number.isFinite(n) ? null : n;
};
const keyOf = (r: { symbol: unknown; expiry: unknown }) => `${r.symbol}|${r.expiry}`;

export async function GET() {
    const now = Date.now();
    if (g.__statsCache && now - g.__statsCache.at < 5_000) return NextResponse.json(g.__statsCache.body);

    try {
        const latestQ = await questdb.query(
            `SELECT max(${TS_COL}) AS t FROM ${TABLE} WHERE ${TS_COL} > dateadd('d', -10, now())`,
        );
        const latest = latestQ.rows[0]?.t ? new Date(latestQ.rows[0].t).getTime() : null;
        if (latest == null) return NextResponse.json({ stats: {} });

        // start of the session (UTC ms) containing the newest tick
        const dayStart = Math.floor((latest + IST_MS - SESSION_START_MS) / DAY) * DAY + SESSION_START_MS - IST_MS;
        const dayIso = new Date(dayStart).toISOString(); // computed value, safe to inline in SQL

        // previous close: changes once per session, so cache it
        if (!g.__prevCache || g.__prevCache.day !== dayStart) {
            const fromIso = new Date(dayStart - 7 * DAY).toISOString();
            const prevQ = await questdb.query(
                `SELECT symbol, expiry, last("last") AS prev
         FROM (
           SELECT symbol, expiry, ${TS_COL}, "last" FROM ${TABLE}
           WHERE ${TS_COL} >= '${fromIso}' AND ${TS_COL} < '${dayIso}' AND "last" > 0
           ORDER BY ${TS_COL}
         ) TIMESTAMP(${TS_COL})`,
            );
            const map: Record<string, number> = {};
            for (const r of prevQ.rows) {
                const p = num(r.prev);
                if (p != null) map[keyOf(r)] = p;
            }
            g.__prevCache = { day: dayStart, map };
        }

        const todayQ = await questdb.query(
            `SELECT symbol, expiry,
              first("last") AS open, max("last") AS high, min("last") AS low, count() AS volume
       FROM (
         SELECT symbol, expiry, ${TS_COL}, "last" FROM ${TABLE}
         WHERE ${TS_COL} >= '${dayIso}' AND "last" > 0
         ORDER BY ${TS_COL}
       ) TIMESTAMP(${TS_COL})`,
        );

        const stats: Record<string, unknown> = {};
        for (const r of todayQ.rows) {
            const k = keyOf(r);
            stats[k] = {
                open: num(r.open), high: num(r.high), low: num(r.low), volume: num(r.volume),
                prev: g.__prevCache.map[k] ?? null,
            };
        }

        const body = { sessionStart: dayIso, stats };
        g.__statsCache = { at: now, body };
        return NextResponse.json(body);
    } catch (err) {
        console.error("[/api/market/stats] QuestDB error:", err);
        return NextResponse.json({ stats: {} }, { status: 200 }); // dashboard just keeps showing live quotes
    }
}