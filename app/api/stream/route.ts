import { sampleUnit, resolveExpiry } from "@/lib/candle-sql";
import { subscribe } from "@/lib/live-hub";
import type { Interval } from "../../../lib/chart-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol") ?? "";
    const interval = searchParams.get("interval") ?? "1D";
    const expiryParam = searchParams.get("expiry");

    if (!sampleUnit(interval)) return new Response("Invalid interval", { status: 400 });
    if (!/^[A-Za-z0-9._:\-\/]{1,32}$/.test(symbol)) return new Response("Invalid symbol", { status: 400 });
    if (expiryParam && !/^\d{8}$/.test(expiryParam)) return new Response("Invalid expiry", { status: 400 });

    const expiry = await resolveExpiry(symbol, expiryParam);
    if (!expiry) return new Response("No data for symbol", { status: 404 });

    const enc = new TextEncoder();
    let unsubscribe: (() => void) | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;

    const stream = new ReadableStream({
        start(controller) {
            const write = (text: string) => {
                try {
                    controller.enqueue(enc.encode(text));
                } catch {
                    /* client already gone */
                }
            };
            const cleanup = () => {
                clearInterval(ping);
                unsubscribe?.();
                unsubscribe = undefined;
            };

            write(": connected\n\n");
            unsubscribe = subscribe({ symbol, interval: interval as Interval, expiry }, (candle) =>
                write(`data: ${JSON.stringify(candle)}\n\n`),
            );
            ping = setInterval(() => write(": ping\n\n"), 15_000); // keeps proxies from closing the stream

            req.signal.addEventListener("abort", () => {
                cleanup();
                try {
                    controller.close();
                } catch {
                    /* already closed */
                }
            });
        },
        cancel() {
            clearInterval(ping);
            unsubscribe?.();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no", // tell nginx not to buffer
        },
    });
}