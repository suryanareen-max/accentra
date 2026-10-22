import { auth } from "./lib/auth/server";

export default auth.middleware({ loginUrl: "/login" });

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
  ],
};
