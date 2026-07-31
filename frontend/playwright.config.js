import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

/**
 * Frontend E2E.
 *
 * The API is stubbed by the specs, so this only needs the Vite dev server.
 * That keeps the suite hermetic: no postgres, no Django process, no seeding,
 * and it runs the same on any machine.
 *
 * `--strictPort` is not optional. CORS is hardcoded to localhost:5173 in
 * backend/config/settings.py, so if Vite drifts to 5174 every request fails
 * CORS and the suite reports a wall of confusing errors instead of the real
 * problem. Fail loudly instead.
 */
export default defineConfig({
  testDir: './e2e',
  // Traces only on failure: a trace is a zip of screenshots and DOM at every
  // step, which is gold when a test fails and pure noise when it passes.
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:5173',
    // The app resolves the API against localhost:8000; the stub router
    // intercepts it, so nothing needs to be listening there.
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // Pinned so the app's `prefers-color-scheme` fallback is deterministic
        // on any machine. Seeding localStorage instead would re-run on reload
        // via addInitScript and overwrite whatever the theme toggle saved.
        colorScheme: 'light',
      },
    },
    {
      // The drawer and the card fallbacks only exist at this width, so the
      // mobile project is not optional coverage.
      name: 'mobile',
      use: { ...devices['Pixel 7'], colorScheme: 'light' },
    },
  ],

  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
