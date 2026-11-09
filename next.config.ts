import type { NextConfig } from 'next';

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;

/**
 * open-next.config.ts runs the build with CMS_BUILD_TARGET=cloudflare. That build leaves local mode out completely
 * (lib/cms/index.ts), so node:fs never reaches the Worker. Any other build (`npm run build`, then `npm start`) keeps
 * local mode, read-only, so a plain Node server can show the content in .cms/content.json.
 */
const cloudflareBuild = process.env.CMS_BUILD_TARGET === 'cloudflare';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fixed into the code at build time, so the Cloudflare build can drop the local-mode branch.
  env: { CMS_LOCAL_FILES: cloudflareBuild ? 'off' : 'on' },
  // Title and meta tags go in <head> for every visitor, as the mockup has them, instead of streaming into a hidden
  // <div> in <body> after the page.
  htmlLimitedBots: /.*/,
  images: {
    // Uploads are already resized to WebP in the browser, so pages use plain <img> tags; this only covers next/image use.
    remotePatterns: supabaseHost ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }] : [],
  },
};

export default nextConfig;
