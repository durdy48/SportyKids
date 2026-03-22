/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sportykids/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

module.exports = nextConfig;
