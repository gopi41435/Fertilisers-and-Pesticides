/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['bhburnjildsboaiwfinv.supabase.co'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Enable React strict mode for better development practices
  reactStrictMode: true,
}

module.exports = nextConfig
