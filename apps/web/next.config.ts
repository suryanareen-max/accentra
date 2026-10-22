import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PDF.js loads native canvas and its worker relative to the installed package.
  // Bundling it with webpack loses those runtime dependencies on Vercel.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/documents/*/extract": [
      "../../node_modules/.pnpm/pdf-parse@*/node_modules/pdf-parse/dist/pdf-parse/**/pdf.worker.mjs",
      "../../node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "../../node_modules/.pnpm/@napi-rs+canvas*/node_modules/@napi-rs/**/*",
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "X-Frame-Options", value: "DENY" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }] }];
  },
};

export default nextConfig;
