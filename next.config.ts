import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        hostname: "img.youtube.com",
        pathname: "/vi/**",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;
