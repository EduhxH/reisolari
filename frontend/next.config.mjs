/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build self-contained (.next/standalone) para uma imagem Docker mínima.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false
};

export default nextConfig;
