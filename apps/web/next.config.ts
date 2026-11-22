import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The repository keeps a single authoritative AGENTS.md at the root.
  agentRules: false,
};

export default nextConfig;
