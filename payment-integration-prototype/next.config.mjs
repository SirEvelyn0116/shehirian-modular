/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static generation for pages that use searchParams
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
