/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a second dev/test server run without clobbering the main .next folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // src/instrumentation.ts starts the in-app scheduler when the server boots
  experimental: { instrumentationHook: true },
  async redirects() {
    // Old directory URL (shared links, bookmarks) → new page
    return [{ source: '/public-startups', destination: '/startups', permanent: true }];
  },
};
module.exports = nextConfig;
