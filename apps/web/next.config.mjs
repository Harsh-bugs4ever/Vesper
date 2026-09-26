import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendUrl = (process.env.BACKEND_URL || process.env.API_PROXY_TARGET || "http://127.0.0.1:8000")
  .replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Browsers on another device cannot reach this computer's 127.0.0.1:8000.
  // Proxy through the web origin so QR links work on the local network too.
  async rewrites() {
    return [{
      source: "/backend/:path*",
      destination: `${backendUrl}/:path*`,
    }];
  },
  // Running `next build` while the dev server is open must not replace its chunks.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cache.marriott.com",
      },
      {
        protocol: "https",
        hostname: "**.marriott.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "api.blessingsonthenet.com",
      },
      {
        protocol: "https",
        hostname: "**.gstatic.com",
      },
    ],
  },
};

export default nextConfig;

