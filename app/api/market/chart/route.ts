import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_FASTAPI_BASE_URL;
const MARKET_API_KEY = process.env.NEXT_PUBLIC_FASTAPI_API_KEY;

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        const assetGroup = searchParams.get("asset_group") || "commodity";

        const symbol = searchParams.get("symbol");
        const expiry = searchParams.get("expiry");
        const mode = searchParams.get("mode") || "live";
        const order = searchParams.get("order") || "asc";
        const limit = searchParams.get("limit") || "1000";

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

        if (!expiry) {
            return NextResponse.json(
                {
                    error: "Expiry is required",
                },
                {
                    status: 400,
                }
            );
        }

        const params = new URLSearchParams({
            asset_group: assetGroup,
            symbol,
            expiry,
            mode,
            order,
            limit,
        });

        const apiUrl = `${API_BASE_URL}/historical/chart?${params.toString()}`;

        const response = await fetch(apiUrl, {
            method: "GET",
            headers: {
                accept: "*/*",
                "X-API-Key": MARKET_API_KEY || "",
            },
            cache: "no-store",
        });

        if (!response.ok) {
            const errorText = await response.text();

            console.error(
                "External chart API error:",
                response.status,
                errorText
            );

            return NextResponse.json(
                {
                    error: "Chart API request failed",
                    status: response.status,
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
            "Market chart route error:",
            error
        );

        return NextResponse.json(
            {
                error: "Unable to fetch market chart data",
            },
            {
                status: 500,
            }
        );
    }
}