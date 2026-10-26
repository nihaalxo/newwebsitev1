import type { NextConfig } from 'next';

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Uploads are already resized to WebP in the browser, so pages use plain <img> tags; this only covers next/image use.
    remotePatterns: supabaseHost ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }] : [],
  },
  // Local mode reads .cms/content.json at runtime; ship it with every server function so a deployment
  // without Supabase still shows the committed content.
  outputFileTracingIncludes: {
    '/**': ['./.cms/**/*'],
  },
};

export default nextConfig;
