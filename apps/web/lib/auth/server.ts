import { createNeonAuth } from "@neondatabase/auth/next/server";

// Keep module evaluation safe during `next build`. Vercel can build the app
// before its runtime environment variables are attached to a deployment.
// Auth requests still require the real values in the hosting environment.
const baseUrl = process.env.NEON_AUTH_BASE_URL || "https://build.invalid";
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET || "build-only-cookie-secret-32-characters-long";

export const auth = createNeonAuth({
  baseUrl,
  cookies: { secret: cookieSecret, sessionDataTtl: 300 },
});
