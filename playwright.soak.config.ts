import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/soak',
  outputDir: 'test-results/soak',
  timeout: 240_000,
  workers: 1,
  fullyParallel: false,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4199', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4199', url: 'http://127.0.0.1:4199', reuseExistingServer: false },
});
