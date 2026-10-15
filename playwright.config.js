import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: '.artifacts/browser-results',
  use: {
    baseURL: 'http://127.0.0.1:5503/QxBlog/',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'node scripts/build.js --content tests/fixtures/posts --out .preview/browser --base /QxBlog/ && node scripts/preview.js --out .preview/browser --base /QxBlog/ --port 5503',
    url: 'http://127.0.0.1:5503/QxBlog/',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
