/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a second dev/test server run without clobbering the main .next folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};
module.exports = nextConfig;
