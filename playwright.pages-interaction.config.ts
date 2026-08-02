import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pages',
  testMatch: /interaction-live\.spec\.ts/,
  outputDir: 'release-artifacts/live-pages/interaction/playwright-output',
  timeout: 120_000,
  workers: 1,
  fullyParallel: false,
  use: { baseURL: 'https://futaba-ario.github.io/cosmic-garden/', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
