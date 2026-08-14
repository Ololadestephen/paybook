import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@paybook/disclosure", "@paybook/sdk"],
};

export default nextConfig;
