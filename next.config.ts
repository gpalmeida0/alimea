import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Lets a second dev server (e.g. the in-memory demo) run beside the main one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      // Logo / PDF template uploads go through server actions.
      bodySizeLimit: "10mb",
    },
  },
  // The PDF engine reads its fonts and default logo from disk at runtime; make
  // sure serverless bundles (e.g. Vercel) include them.
  outputFileTracingIncludes: {
    "/api/pdf/[planId]": ["./src/lib/pdf/fonts/**/*", "./public/pdf-assets/**/*"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
