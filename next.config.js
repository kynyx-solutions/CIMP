/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a second dev/test server run without clobbering the main .next folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async redirects() {
    // Old directory URL (shared links, bookmarks) → new page
    return [{ source: '/public-startups', destination: '/startups', permanent: true }];
  },
};
module.exports = nextConfig;
