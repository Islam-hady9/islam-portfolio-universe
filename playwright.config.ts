import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the production server (`npm run build` first). Headless browsers use
 * software GL, so the default projects exercise the static/fallback path deterministically;
 * the opt-in `gpu` project (E2E_GPU=1) runs the WebGL suite on the machine's real GPU.
 */
const PORT = Number(process.env.E2E_PORT ?? 3200);
const baseURL = `http://localhost:${PORT}`;
const gpu = process.env.E2E_GPU === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  timeout: 45_000,
  expect: { timeout: 8_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' } },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /(webgl|mobile|local-ai\.gpu)\.spec\.ts/,
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /(mobile|smoke|media|resume|ask-ai|glass)\.spec\.ts/,
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
      testMatch: /(smoke|media|resume|ask-ai|glass)\.spec\.ts/,
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
      testMatch: /(smoke|media|resume|ask-ai|glass)\.spec\.ts/,
      // Headless WebKit on Windows renders WebGL and decodes video on the CPU: parallel WebKit
      // pages starve each other (measured: lost WebGL contexts, frames stalling actionability
      // checks). One WebKit worker at a time; the other projects still run in parallel.
      workers: 1,
    },
    ...(gpu
      ? [
          {
            name: 'gpu',
            testMatch: /(webgl|local-ai\.gpu)\.spec\.ts/,
            use: {
              viewport: { width: 1440, height: 900 },
              channel: 'chromium',
              launchOptions: { args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] },
            },
          },
        ]
      : []),
  ],
});
