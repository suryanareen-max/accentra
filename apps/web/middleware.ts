import { auth } from "./lib/auth/server";
import { NextRequest, NextResponse } from "next/server";

const protect = auth.middleware({ loginUrl: "/login" });

export default async function middleware(request: NextRequest) {
  const api = request.nextUrl.pathname.startsWith("/api/");
  try {
    const response = await protect(request);
    if (api && response.headers.get("location")) {
      const unauthorized = NextResponse.json({ error: "Your session expired. Sign in again, then retry the upload.", code: "SESSION_REQUIRED" }, { status: 401 });
      for (const cookie of response.cookies.getAll()) unauthorized.cookies.set(cookie);
      return unauthorized;
    }
    return response;
  } catch (error) {
    console.error("Session verification failed", error);
    if (api) return NextResponse.json({ error: "Unable to verify your session. Please sign in again.", code: "AUTH_UNAVAILABLE" }, { status: 503 });
    throw error;
  }
}

export const config = {
  runtime: "nodejs",
  matcher: [
    "/dashboard/:path*",
    "/review/:path*",
    "/api/documents/:path*",
    "/api/account-books/:path*",
    "/api/reviews/:path*",
    "/api/postings/:path*",
    "/api/chat",
    "/api/autocount/:path*",
    "/api/audit/:path*",
    "/post-queue/:path*",
    "/chat/:path*",
  ],
};
