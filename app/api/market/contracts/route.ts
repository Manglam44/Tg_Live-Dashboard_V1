import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_FASTAPI_BASE_URL;
const MARKET_API_KEY = process.env.NEXT_PUBLIC_FASTAPI_API_KEY;

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        const assetGroup =
            searchParams.get("asset_group") || "commodity";

        const symbol = searchParams.get("symbol");
        const mode = searchParams.get("mode") || "live";

        if (!symbol) {
            return NextResponse.json(
                {
                    error: "Symbol is required",
                },
                {
                    status: 400,
                }
            );
        }

        const params = new URLSearchParams({
            asset_group: assetGroup,
            symbol,
            mode,
        });

        const response = await fetch(
            `${API_BASE_URL}/historical/contracts?${params.toString()}`,
            {
                method: "GET",
                headers: {
                    accept: "*/*",
                    "X-API-Key": MARKET_API_KEY || "",
                },

                // Important for live market data
                cache: "no-store",
            }
        );

        if (!response.ok) {
            const errorText = await response.text();

            return NextResponse.json(
                {
                    error: "Market API request failed",
                    details: errorText,
                },
                {
                    status: response.status,
                }
            );
        }

        const data = await response.json();

        return NextResponse.json(data, {
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate",
            },
        });
    } catch (error) {
        console.error("Market contracts API error:", error);

        return NextResponse.json(
            {
                error: "Unable to fetch market data",
            },
            {
                status: 500,
            }
        );
    }
}