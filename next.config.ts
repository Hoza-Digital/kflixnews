import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/admin',
  async redirects() {
    return [
      {
        source: '/',
        destination: '/admin',
        basePath: false,
        permanent: false,
      },
    ];
  },
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
