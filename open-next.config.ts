import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Every public page renders per request from D1, so there is no incremental cache to configure.
export default defineCloudflareConfig({});
