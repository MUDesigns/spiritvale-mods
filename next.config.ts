import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["postgres"],
  experimental: {
    // Proxy clones request bodies; the default 10 MB silently truncates zip PUTs.
    proxyClientMaxBodySize: "80mb",
  },
};

export default nextConfig;
