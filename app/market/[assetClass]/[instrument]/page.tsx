"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useInstrumentQuotes } from "@/hooks/useInstrumentQuotes";
import { DetailShell } from "@/components/market-detail/DetailShell";
import { CommodityInstrumentDetail } from "@/components/market-detail/CommodityInstrumentDetail";
import { CurrencyInstrumentDetail } from "@/components/market-detail/CurrencyInstrumentDetail";

export default function InstrumentDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();

    const assetClass = String(params.assetClass);
    const instrument = decodeURIComponent(String(params.instrument));

    const mode = searchParams.get("mode") || "live";
    const instrumentType = searchParams.get("instrument_type") || "";
    const expiry = searchParams.get("expiry") || "";
    const strike = searchParams.get("strike") || "";
    const right = searchParams.get("right") || "";

    const commodityName = searchParams.get("name") || "";
    const symbol = searchParams.get("symbol") || "";

    const { quotes, latestQuote, loading, refreshing, error, refresh } = useInstrumentQuotes({
        assetClass,
        instrument,
        commodityName,
        symbol,
        mode,
        instrumentType,
        expiry,
        strike,
        right,
    });

    const decimals = assetClass === "currency" ? 5 : 2;
    const title = latestQuote?.name || latestQuote?.symbol || latestQuote?.pair || instrument;

    return (
        <DetailShell
            title={title}
            assetClass={assetClass}
            instrumentType={instrumentType}
            mode={mode}
            latestQuote={latestQuote}
            loading={loading}
            refreshing={refreshing}
            error={error}
            onRefresh={refresh}
        >
            {latestQuote &&
                (assetClass === "currency" ? (
                    <CurrencyInstrumentDetail quotes={quotes} latestQuote={latestQuote} decimals={decimals} />
                ) : (
                    <CommodityInstrumentDetail
                        quotes={quotes}
                        latestQuote={latestQuote}
                        decimals={decimals}
                        initialExpiry={expiry}
                    />
                ))}
        </DetailShell>
    );
}
