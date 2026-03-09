import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  test: {
    include: ['**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/api/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/api/junit.xml',
    },
    sequence: {
      concurrent: false,
    },
  },
});
