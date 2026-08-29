import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname
  },
  async headers() {
    const longCache = "public, max-age=31536000, immutable";
    return [
      {
        source: "/:all*(svg|png|jpg|jpeg|webp|gif|ico|avif|js|css|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: longCache,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
