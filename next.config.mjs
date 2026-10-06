/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/@:handle",
        destination: "/u/:handle",
      },
      {
        source: "/@:handle/:slug",
        destination: "/u/:handle/:slug",
      },
    ];
  },
};

export default nextConfig;
