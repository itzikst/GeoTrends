import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  /* Maximum execution time for one test */
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  /* Strict limitation to run exactly 4 tests in parallel for standard/shabby hardware limits */
  workers: 4,
  /* Reporter to use */
  reporter: 'html',
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to connect to the local server */
    baseURL: 'http://localhost:8080',
    /* Collect trace when retrying a failed test */
    trace: 'on-first-retry',
    /* Capture video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers and viewport combinations */
  projects: [
    // ----------------------------------------------------
    // DESKTOP LAYOUT (1920x1080)
    // ----------------------------------------------------
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'desktop-firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'desktop-safari',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    // ----------------------------------------------------
    // LAPTOP LAYOUT (1366x768)
    // ----------------------------------------------------
    {
      name: 'laptop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 768 }
      },
    },
    {
      name: 'laptop-firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1366, height: 768 }
      },
    },
    {
      name: 'laptop-safari',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1366, height: 768 }
      },
    },

    // ----------------------------------------------------
    // MOBILE LAYOUT (390x844)
    // ----------------------------------------------------
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 }
      },
    },
    {
      name: 'mobile-firefox',
      use: {
        ...devices['Pixel 5'], // Use emulated pixel features on firefox engine
        viewport: { width: 390, height: 844 }
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 }
      },
    },
  ],

  /* Run the local HTTP server before starting tests */
  webServer: {
    command: 'node server.js',
    port: 8080,
    reuseExistingServer: true,
  },
});
