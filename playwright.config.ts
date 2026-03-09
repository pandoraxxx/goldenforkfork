import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/e2e/html', open: 'never' }],
    ['junit', { outputFile: 'test-results/e2e/junit.xml' }],
  ],
  outputDir: 'test-results/e2e/artifacts',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node backend/server.js',
      url: 'http://127.0.0.1:4000/api/health',
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...process.env,
        API_HOST: '127.0.0.1',
        API_PORT: '4000',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_BASE_URL: 'http://127.0.0.1:4000',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
