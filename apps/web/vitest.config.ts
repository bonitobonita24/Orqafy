import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Automatic JSX runtime (react/jsx-runtime) so a .test.ts can import a
  // .tsx module (e.g. a server component) without every such module having
  // to hand-import React — matches Next.js's own automatic-runtime build.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['src/**/*.test.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
});
