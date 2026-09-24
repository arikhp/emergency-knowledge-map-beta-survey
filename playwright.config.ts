import { defineConfig, devices } from '@playwright/test';

// The bots run against a production build served by `vite preview`. The build
// points submissions at a fake endpoint that every test intercepts, so no
// real Google Sheet is touched. Set BASE_URL to run the same suite against a
// deployed site (e.g. a Vercel preview) instead of the local build.
const FAKE_ENDPOINT = 'https://sheet.test/exec';

const PORT = 4173;

if (process.env.LIVE && !process.env.LIVE_ENDPOINT) {
  throw new Error('LIVE=1 needs LIVE_ENDPOINT set to the *test* Apps Script URL.');
}
const externalBaseUrl = process.env.BASE_URL;
// Vercel preview deployments are behind deployment protection; this secret
// ("Protection Bypass for Automation") lets the bots through.
const vercelBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // PDF rendering is CPU-heavy; too many parallel browsers starve each other.
  // 2 is both stable and fastest locally; 4 caused timeouts in submit/PDF tests.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  // PDF generation (html2canvas + jsPDF) takes a few seconds per submission.
  timeout: 60_000,
  // @live tests hit a real backend and only run when explicitly requested.
  grep: process.env.LIVE ? /@live/ : undefined,
  grepInvert: process.env.LIVE ? undefined : /@live/,
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${PORT}/emergency-knowledge-map-beta-survey/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    extraHTTPHeaders: vercelBypass
      ? { 'x-vercel-protection-bypass': vercelBypass, 'x-vercel-set-bypass-cookie': 'true' }
      : undefined,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}/emergency-knowledge-map-beta-survey/`,
        // Always rebuild: a stale server could be baked with the real endpoint from .env.local.
        reuseExistingServer: false,
        timeout: 180_000,
        env: { VITE_SHEET_ENDPOINT: process.env.LIVE_ENDPOINT ?? FAKE_ENDPOINT },
      },
});
