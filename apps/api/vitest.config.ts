import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/middleware/**', 'src/utils/**', 'src/routes/**'],
    },
  },
});
