import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "https://preview-chat-1ccf6e24-e815-4c9d-a5e2-8cc3a9688221.space.z.ai",
  ],
};

export default nextConfig;
