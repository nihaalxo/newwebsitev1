import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Every public page renders per request from D1, so there is no incremental cache to configure.
export default {
  ...defineCloudflareConfig({}),
  // CMS_BUILD_TARGET=cloudflare leaves local mode (and node:fs) out of the Worker: see next.config.ts and
  // lib/cms/index.ts. `npm run build` adds node_modules/.bin to the path, however the OpenNext build was started.
  buildCommand: 'CMS_BUILD_TARGET=cloudflare npm run build',
};
