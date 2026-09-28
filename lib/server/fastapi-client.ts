/**
 * Single server-side client for the FastAPI market backend.
 *
 * All Next.js server routes should use this client so authentication,
 * timeout handling and error formatting remain consistent.
 */

const FASTAPI_BASE_URL =
    process.env.FASTAPI_BASE_URL ??
    "http://127.0.0.1:8000";

const FASTAPI_API_KEY =
    process.env.FASTAPI_API_KEY;

const DEFAULT_TIMEOUT_MS = 12000;

export class FastApiError extends Error {
    status: number;

    constructor(
        message: string,
        status: number
    ) {
        super(message);
        this.name = "FastApiError";
        this.status = status;
    }
}

if (
    !FASTAPI_API_KEY &&
    process.env.NODE_ENV !== "production"
) {
    console.warn(
        "[fastapi-client] FASTAPI_API_KEY is not set."
    );
}

export async function fastapiGet<T>(
    path: string,
    searchParams?: Record<
        string,
        string | number | undefined
    >,
    timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
    const url = new URL(
        path,
        FASTAPI_BASE_URL
    );

    if (searchParams) {
        for (const [key, value] of Object.entries(
            searchParams
        )) {
            if (value !== undefined) {
                url.searchParams.set(
                    key,
                    String(value)
                );
            }
        }
    }

    const controller =
        new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        timeoutMs
    );

    try {
        const response = await fetch(
            url.toString(),
            {
                method: "GET",
                cache: "no-store",
                signal: controller.signal,
                headers: {
                    Accept:
                        "application/json",
                    ...(FASTAPI_API_KEY
                        ? {
                              "X-API-Key":
                                  FASTAPI_API_KEY,
                          }
                        : {}),
                },
            }
        );

        if (!response.ok) {
            const body =
                await response
                    .text()
                    .catch(() => "");

            throw new FastApiError(
                `FastAPI ${path} returned ${response.status}${
                    body
                        ? `: ${body}`
                        : ""
                }`,
                response.status
            );
        }

        return (await response.json()) as T;
    } catch (err) {
        if (err instanceof FastApiError) {
            throw err;
        }

        if (
            err instanceof Error &&
            err.name === "AbortError"
        ) {
            throw new FastApiError(
                `FastAPI ${path} timed out after ${timeoutMs}ms`,
                504
            );
        }

        throw new FastApiError(
            `FastAPI ${path} request failed: ${
                err instanceof Error
                    ? err.message
                    : String(err)
            }`,
            502
        );
    } finally {
        clearTimeout(timeout);
    }
}
