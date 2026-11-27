import { defineConfig } from '@playwright/test';

// Browser tests: the production build (npm run test:browser builds it first), served by vite preview,
// driven in Google Chrome. Set PW_CHANNEL=chromium to use Playwright's own browser instead
// (after `npx playwright install chromium`).
export default defineConfig({
  testDir: 'tests/browser',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    channel: process.env.PW_CHANNEL || 'chrome',
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10_000,
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'npx vite preview --port 4174 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
