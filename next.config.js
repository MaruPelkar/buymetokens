/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['avatars.githubusercontent.com', 'github.com'],
  },
  // output: 'standalone' creates a self-contained production bundle for Docker.
  // Only activated when NEXT_OUTPUT=standalone is set (done in the Dockerfile builder stage).
  // Has no effect on `npm run dev` or normal `npm run build` without the env var.
  ...(process.env.NEXT_OUTPUT === 'standalone' && { output: 'standalone' }),
}

module.exports = nextConfig
