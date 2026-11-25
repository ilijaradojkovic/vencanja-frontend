import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test-integration/**/*.test.ts'],
    fileParallelism: false,
    env: { LOG_LEVEL: 'silent' },
    testTimeout: 30_000,
  },
});
