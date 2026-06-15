/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  async headers() {
    return [
      // ── Security headers — applied to every response ──────────────────────
      // CSP ships as Report-Only so violations are visible before enforcement.
      // Promote to Content-Security-Policy (enforcing) in a future tag once
      // the report-uri endpoint is wired and zero violations are confirmed.
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "img-src 'self' data: blob: https:",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "connect-src 'self' https:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      // ── Static-asset cache headers ────────────────────────────────────────
      {
        source: "/assets/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*.woff2",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*.woff",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*.ttf",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },

  async redirects() {
    return [
      { source: "/dashboard/sales", destination: "/dashboard/reservations", permanent: true },
      { source: "/dashboard/sales/:path*", destination: "/dashboard/reservations", permanent: true },
      { source: "/dashboard/deals", destination: "/dashboard/reservations", permanent: true },
      { source: "/dashboard/deals/:path*", destination: "/dashboard/reservations", permanent: true },
      { source: "/dashboard/rentals", destination: "/dashboard/contracts", permanent: true },
      { source: "/dashboard/rentals/:path*", destination: "/dashboard/contracts", permanent: true },
    ];
  },
};

export default nextConfig;
