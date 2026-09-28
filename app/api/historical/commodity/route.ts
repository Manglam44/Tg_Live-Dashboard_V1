import {
    NextRequest,
    NextResponse,
} from "next/server";
import {
    fastapiGet,
    FastApiError,
} from "@/lib/server/fastapi-client";

export async function GET(
    request: NextRequest
) {
    try {
        const params =
            Object.fromEntries(
                request.nextUrl.searchParams.entries()
            );

        const data =
            await fastapiGet<unknown>(
                "/historical/commodity",
                params
            );

        if (!Array.isArray(data)) {
            return NextResponse.json(
                {
                    error:
                        "FastAPI returned an invalid commodity response",
                },
                { status: 502 }
            );
        }

        return NextResponse.json(
            data,
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
                : 502;

        const message =
            err instanceof Error
                ? err.message
                : "Unable to connect to market API";

        console.error(
            "Historical commodity proxy error:",
            err
        );

        return NextResponse.json(
            { error: message },
            { status }
        );
    }
}
