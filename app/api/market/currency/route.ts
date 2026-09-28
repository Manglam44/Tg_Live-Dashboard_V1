import {
    NextRequest,
    NextResponse,
} from "next/server";
import type { Mode } from "@/lib/types";
import {
    getCurrencyQuotes,
} from "@/lib/server/market/currency";
import {
    FastApiError,
} from "@/lib/server/fastapi-client";

function parseMode(value: string | null): Mode {
    return value === "delayed"
        ? "delayed"
        : "live";
}

function parseLimit(value: string | null): number {
    const parsed = Number(value ?? 500);

    if (!Number.isFinite(parsed)) {
        return 500;
    }

    return Math.min(
        5000,
        Math.max(1, Math.trunc(parsed))
    );
}

export async function GET(
    request: NextRequest
) {
    const searchParams =
        request.nextUrl.searchParams;

    const mode = parseMode(
        searchParams.get("mode")
    );

    const limit = parseLimit(
        searchParams.get("limit")
    );

    try {
        const quotes =
            await getCurrencyQuotes(
                mode,
                limit
            );

        return NextResponse.json(
            quotes,
            {
                headers: {
                    "Cache-Control":
                        "no-store, max-age=0",
                },
            }
        );
    } catch (err) {
        const status =
            err instanceof FastApiError
                ? err.status
                : 500;

        const message =
            err instanceof Error
                ? err.message
                : "Failed to load currency quotes";

        return NextResponse.json(
            { error: message },
            { status }
        );
    }
}
