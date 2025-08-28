/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'source.unsplash.com',
      'images.unsplash.com',
      'lh3.googleusercontent.com',
      'res.cloudinary.com',
      'supabase.co',
    ],
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
};

module.exports = nextConfig;
