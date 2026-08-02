import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /mobile-emulation\.spec\.ts/,
  outputDir: 'test-results/mobile',
  timeout: 45_000,
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4175', screenshot: 'only-on-failure', acceptDownloads: true },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4175', url: 'http://127.0.0.1:4175', reuseExistingServer: true },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'pixel-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
  ],
});
