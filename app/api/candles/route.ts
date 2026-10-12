import { NextResponse } from "next/server";
import { fetchCandles, resolveExpiry, sampleUnit } from "@/lib/candle-sql";
import type { Interval } from "../../../lib/chart-data";

export const runtime = "nodejs"; // `pg` needs Node, not Edge
export const dynamic = "force-dynamic";

const MAX_BARS = 1000;

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol") ?? "";
    const interval = searchParams.get("interval") ?? "1D";
    const expiryParam = searchParams.get("expiry");

    if (!sampleUnit(interval)) return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
    if (!/^[A-Za-z0-9._:\-\/]{1,32}$/.test(symbol))
        return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
    if (expiryParam && !/^\d{8}$/.test(expiryParam))
        return NextResponse.json({ error: "Invalid expiry (use YYYYMMDD)" }, { status: 400 });

    try {
        const expiry = await resolveExpiry(symbol, expiryParam);
        if (!expiry) return NextResponse.json([]); // no data for this symbol yet

        const out = await fetchCandles(symbol, expiry, interval as Interval, MAX_BARS);
        return NextResponse.json(out, { headers: { "x-contract-expiry": expiry } });
    } catch (err) {
        console.error("[/api/candles] QuestDB error:", err);
        const e = err as { message?: string; code?: string };
        return NextResponse.json(
            {
                error: "Failed to load candles",
                ...(process.env.NODE_ENV !== "production" && { detail: e.message, code: e.code }),
            },
            { status: 500 },
        );
    }
}