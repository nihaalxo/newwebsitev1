import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

/**
 * `npm run build` exports the whole site as plain files in out/ (output 'export'): the public pages, the 404 page and
 * the admin's pages. Nothing renders per request on Cloudflare.
 *
 * `npm run dev` also serves the two dev-only routes (route.dev.ts): the admin API, which writes straight into
 * content/ and public/uploads/p/, and the admin's copy of the published content. They are left out of the export
 * because their extension is only listed here.
 */
export default function config(phase: string): NextConfig {
  const shared: NextConfig = {
    reactStrictMode: true,
    // Title and meta tags go in <head> for every visitor, as the mockup has them, instead of streaming into a hidden
    // <div> in <body> after the page.
    htmlLimitedBots: /.*/,
  };
  if (phase === PHASE_DEVELOPMENT_SERVER) return { ...shared, pageExtensions: ['tsx', 'ts', 'dev.ts'] };
  return {
    ...shared,
    output: 'export',
    trailingSlash: false,
    // Uploads are already resized to WebP in the browser, so pages use plain <img> tags.
    images: { unoptimized: true },
    pageExtensions: ['tsx', 'ts'],
  };
}
