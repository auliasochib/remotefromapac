import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so builds trace files from this project only
  // (a lockfile in the home directory otherwise confuses Turbopack).
  turbopack: {
    root: path.resolve(__dirname),
  },
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
