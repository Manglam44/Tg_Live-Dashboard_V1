import type { MarketQuote } from "@/lib/types";
import { formatDateTime, formatNumber } from "@/lib/dashboard/format";
import { DetailItem, PriceCard } from "@/components/market-detail/primitives";
import { PriceHistoryChart } from "@/components/market-detail/PriceHistoryChart";
import { RelatedDataTable } from "@/components/market-detail/RelatedDataTable";

interface CurrencyInstrumentDetailProps {
    quotes: MarketQuote[];
    latestQuote: MarketQuote;
    decimals: number;
}

export function CurrencyInstrumentDetail({ quotes, latestQuote, decimals }: CurrencyInstrumentDetailProps) {
    const spread =
        latestQuote.ask != null && latestQuote.bid != null ? latestQuote.ask - latestQuote.bid : null;

    return (
        <>
            {/* PRICE */}
            <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <PriceCard label="Bid" value={latestQuote.bid} decimals={decimals} />
                <PriceCard label="Ask" value={latestQuote.ask} decimals={decimals} />
                <PriceCard label="Last" value={latestQuote.last} decimals={decimals} />
                <PriceCard label="Spread" value={spread} decimals={decimals} />
            </section>

            {/* CHART */}
            <section className="mb-5">
                <PriceHistoryChart quotes={quotes} decimals={decimals} />
            </section>

            {/* PAIR INFO */}
            <section className="mb-5">
                <div className="mb-3">
                    <h2 className="text-sm font-semibold text-white">Pair Information</h2>
                    <p className="mt-1 text-xs text-slate-600">Complete instrument information returned by the market API.</p>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                    <DetailItem label="Pair" value={latestQuote.pair} mono />
                    <DetailItem label="Name" value={latestQuote.name} />
                    <DetailItem label="Symbol" value={latestQuote.symbol} mono />
                    <DetailItem label="Asset Class" value={latestQuote.asset_class} />
                    <DetailItem label="Instrument Type" value={latestQuote.instrument_type} />
                    <DetailItem label="Exchange" value={latestQuote.exchange} />
                    <DetailItem label="Mode" value={latestQuote.mode} />
                    <DetailItem label="Bid Size" value={formatNumber(latestQuote.bid_size, 2)} mono />
                    <DetailItem label="Ask Size" value={formatNumber(latestQuote.ask_size, 2)} mono />
                    <DetailItem label="Last Size" value={formatNumber(latestQuote.last_size, 2)} mono />
                    <DetailItem label="Ticker Time" value={latestQuote.ticker_time} mono />
                    <DetailItem label="Ticker Time Zone" value={latestQuote.ticker_time_zone} />
                    <DetailItem label="Quote Time" value={formatDateTime(latestQuote.ticker_time)} />
                    {/* Forward/NDF-style currency contracts still carry these — shown only when present. */}
                    {latestQuote.expiry && <DetailItem label="Expiry" value={latestQuote.expiry} mono />}
                    {latestQuote.strike != null && <DetailItem label="Strike" value={latestQuote.strike} mono />}
                    {latestQuote.right && <DetailItem label="Right" value={latestQuote.right} />}
                </div>
            </section>

            <RelatedDataTable quotes={quotes} decimals={decimals} latestQuoteTime={latestQuote.ticker_time} />
        </>
    );
}
