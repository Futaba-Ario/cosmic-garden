import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /live-pages-mobile\.spec\.ts/,
  outputDir: 'test-results/live-pages-mobile',
  timeout: 60_000,
  fullyParallel: true,
  use: { baseURL: 'https://futaba-ario.github.io/cosmic-garden/', screenshot: 'only-on-failure', acceptDownloads: true },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'pixel-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
  ],
});
