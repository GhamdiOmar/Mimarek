/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  async headers() {
    return [
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
      { source: "/dashboard/sales", destination: "/dashboard/deals", permanent: true },
      { source: "/dashboard/sales/:path*", destination: "/dashboard/deals", permanent: true },
      { source: "/dashboard/rentals", destination: "/dashboard/contracts", permanent: true },
      { source: "/dashboard/rentals/:path*", destination: "/dashboard/contracts", permanent: true },
    ];
  },
};

export default nextConfig;
