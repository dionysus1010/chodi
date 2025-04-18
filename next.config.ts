import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  appDir: true,
  webpack: (config) => {
    config.resolve.fallback = { 
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      child_process: false,
    };
    return config;
  },
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
};

export default nextConfig;