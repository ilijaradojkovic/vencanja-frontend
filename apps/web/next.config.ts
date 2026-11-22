import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript sources that Next.js must compile.
  transpilePackages: ['@uspomena/api', '@uspomena/shared'],
  // The repository keeps a single authoritative AGENTS.md at the root.
  agentRules: false,
};

export default nextConfig;
