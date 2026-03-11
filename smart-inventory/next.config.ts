import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Generate unique build ID to prevent stale chunk issues
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
};

export default nextConfig;
