import { fetchLatestCandle } from "@/lib/candle-sql";
import type { Interval, RawRow } from "./chart-data";

const POLL_MS = Number(process.env.LIVE_POLL_MS ?? 1000);

type Listener = (c: RawRow) => void;
type Hub = {
    listeners: Set<Listener>;
    timer?: ReturnType<typeof setInterval>;
    busy: boolean; // skip a tick if the previous query is still running
    sig?: string; // last payload, so we only push real changes
    latest?: RawRow;
};

// One hub per symbol+interval+expiry, shared by every connected browser.
// Stored on globalThis so Next.js hot reloads don't leak timers.
const g = globalThis as unknown as { __liveHubs?: Map<string, Hub> };
const hubs = (g.__liveHubs ??= new Map<string, Hub>());

export function subscribe(
    p: { symbol: string; interval: Interval; expiry: string },
    listener: Listener,
): () => void {
    const key = `${p.symbol}|${p.interval}|${p.expiry}`;
    let hub = hubs.get(key);

    if (!hub) {
        const h: Hub = { listeners: new Set(), busy: false };
        const tick = async () => {
            if (h.busy) return;
            h.busy = true;
            try {
                const c = await fetchLatestCandle(p.symbol, p.expiry, p.interval);
                if (c) {
                    const sig = JSON.stringify(c);
                    if (sig !== h.sig) {
                        h.sig = sig;
                        h.latest = c;
                        h.listeners.forEach((l) => l(c));
                    }
                }
            } catch (err) {
                console.error("[live-hub] QuestDB poll failed:", err);
            } finally {
                h.busy = false;
            }
        };
        h.timer = setInterval(tick, POLL_MS);
        void tick();
        hubs.set(key, h);
        hub = h;
    }

    hub.listeners.add(listener);
    if (hub.latest) listener(hub.latest); // new viewer gets the current candle at once

    const current = hub;
    return () => {
        current.listeners.delete(listener);
        if (current.listeners.size === 0) {
            clearInterval(current.timer); // nobody watching: stop querying
            hubs.delete(key);
        }
    };
}