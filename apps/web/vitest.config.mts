import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Threshold scope from SPEC §1.1: product features and shared UI. Server
      // components under `app/` and `src/lib` are covered by E2E and the spike
      // check instead.
      include: ['src/features/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
      thresholds: { lines: 60, branches: 60 },
    },
  },
});
