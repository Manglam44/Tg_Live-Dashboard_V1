"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { MarketQuote } from "@/lib/types";
import { formatDateTime, formatNumber, formatExpiry } from "@/lib/dashboard/format";
import { expiryTimestamp } from "@/lib/dashboard/quotes";

import { DetailItem, PriceCard } from "@/components/market-detail/primitives";
import { PriceHistoryChart } from "@/components/market-detail/PriceHistoryChart";
import { RelatedDataTable } from "@/components/market-detail/RelatedDataTable";
import CommodityPriceChart from "./CommodityPriceChart";

interface CommodityInstrumentDetailProps {
    quotes: MarketQuote[];
    latestQuote: MarketQuote;
    decimals: number;

    initialExpiry?: string;
    name?: string;
    symbol?: string;
}


export function CommodityInstrumentDetail({
    quotes,
    latestQuote,
    decimals,
    initialExpiry = "",
    name = "",
    symbol = "",
}: CommodityInstrumentDetailProps) {


    return (
        <div>

        </div>
    );
}