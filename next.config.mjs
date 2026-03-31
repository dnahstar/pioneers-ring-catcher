/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.GITHUB_ACTIONS ? '/pioneers-ring-catcher' : '',
  images: {
    unoptimized: true,
  },
}

export default nextConfig
