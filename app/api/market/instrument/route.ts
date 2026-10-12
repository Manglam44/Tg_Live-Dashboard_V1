// app/api/market/instrument/route.ts

import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_FASTAPI_BASE_URL;
const MARKET_API_KEY = process.env.NEXT_PUBLIC_FASTAPI_API_KEY;

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        const assetGroup =
            searchParams.get("asset_group") || "commodity";

        const symbol = searchParams.get("symbol");
        const expiry = searchParams.get("expiry");
        const mode = searchParams.get("mode") || "live";

        const page = searchParams.get("page") || "1";
        const pageSize = searchParams.get("page_size") || "500";
        const order = searchParams.get("order") || "desc";

        if (!symbol) {
            return NextResponse.json(
                { error: "Symbol is required" },
                { status: 400 }
            );
        }

        if (!expiry) {
            return NextResponse.json(
                { error: "Expiry is required" },
                { status: 400 }
            );
        }

        const params = new URLSearchParams({
            asset_group: assetGroup,
            symbol,
            expiry,
            mode,
            page,
            page_size: pageSize,
            order,
        });

        const response = await fetch(`${API_BASE_URL}/historical/instrument?${params.toString()}`,
            {
                method: "GET",
                headers: {
                    accept: "*/*",
                    "X-API-Key": MARKET_API_KEY || "",
                },
                cache: "no-store",
            }
        );

        if (!response.ok) {
            const errorText = await response.text();

            console.error(
                "Historical instrument API error:",
                response.status,
                errorText
            );

            return NextResponse.json(
                {
                    error: "Historical instrument API request failed",
                    details: errorText,
                },
                {
                    status: response.status,
                }
            );
        }

        const data = await response.json();

        return NextResponse.json(data, {
            status: 200,
            headers: {
                "Cache-Control":
                    "no-store, no-cache, must-revalidate, proxy-revalidate",
                Pragma: "no-cache",
                Expires: "0",
            },
        });
    } catch (error) {
        console.error(
            "Historical instrument route error:",
            error
        );

        return NextResponse.json(
            {
                error: "Unable to fetch historical instrument data",
            },
            {
                status: 500,
            }
        );
    }
}