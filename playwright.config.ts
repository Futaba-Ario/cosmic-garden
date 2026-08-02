import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/e2e',
  testIgnore: /(mobile-emulation|live-pages-mobile)\.spec\.ts/,
  timeout: 20_000,
  use: { baseURL: 'http://127.0.0.1:4173', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
});
