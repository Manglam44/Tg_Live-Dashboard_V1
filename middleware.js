import { NextResponse } from "next/server";

export function middleware(request) {
    const { pathname } = request.nextUrl;

    // Read authentication cookie
    const authCookie = request.cookies.get("market_auth");

    // Protect /dashboard and every route under /dashboard
    if (pathname.startsWith("/dashboard")) {
        // User is not logged in
        if (!authCookie || authCookie.value !== "true") {
            const loginUrl = new URL("/login", request.url);

            // Optional: remember where the user tried to go
            loginUrl.searchParams.set("redirect", pathname);

            return NextResponse.redirect(loginUrl);
        }
    }

    if (pathname.startsWith("/market/commodity")) {
        // User is not logged in
        if (!authCookie || authCookie.value !== "true") {
            const loginUrl = new URL("/login", request.url);

            // Optional: remember where the user tried to go
            loginUrl.searchParams.set("redirect", pathname);

            return NextResponse.redirect(loginUrl);
        }
    }

    // If user is already logged in and tries to open /login,
    // send them directly to the market dashboard.
    if (pathname === "/login") {
        if (authCookie?.value === "true") {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/login",
        "/market/commodity/:path*",
    ],
};