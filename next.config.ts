import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the E2E server run next to a regular `next dev` without sharing build output.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
