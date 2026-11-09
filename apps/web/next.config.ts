import type { NextConfig } from "next";

const config: NextConfig = {
  // The shared package ships TypeScript source.
  transpilePackages: ["@stickers/shared"],
  async headers() {
    return [
      {
        source: "/.well-known/:path*",
        headers: [{ key: "content-type", value: "application/json" }],
      },
    ];
  },
};

export default config;
