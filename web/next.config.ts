import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  experimental: {
    // CSV import uploads go through server actions. Keep under the ~4.5MB
    // serverless body cap; the action also enforces per-file/total limits.
    serverActions: { bodySizeLimit: '4mb' },
  },
}
export default nextConfig
