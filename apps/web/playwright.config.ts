import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    // Auth setup projects — one per role
    { name: 'auth-admin', testMatch: /auth\.admin\.setup\.ts/ },
    { name: 'auth-pm', testMatch: /auth\.pm\.setup\.ts/ },
    { name: 'auth-sales', testMatch: /auth\.sales\.setup\.ts/ },
    { name: 'auth-tech', testMatch: /auth\.tech\.setup\.ts/ },
    { name: 'auth-system', testMatch: /auth\.system\.setup\.ts/ },

    // Unauthenticated tests (e.g. login page)
    {
      name: 'chromium',
      testMatch: /login\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Admin role tests
    {
      name: 'admin-tests',
      testMatch: /.*\.admin\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['auth-admin'],
    },

    // Project Manager role tests
    {
      name: 'pm-tests',
      testMatch: /.*\.pm\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/pm.json',
      },
      dependencies: ['auth-pm'],
    },

    // Sales Agent role tests
    {
      name: 'sales-tests',
      testMatch: /.*\.sales\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/sales.json',
      },
      dependencies: ['auth-sales'],
    },

    // Technician role tests (negative access)
    {
      name: 'tech-tests',
      testMatch: /.*\.tech\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/tech.json',
      },
      dependencies: ['auth-tech'],
    },

    // System (platform staff) role tests — CX-017 accessibility scan of the
    // /dashboard/admin/* platform surfaces.
    {
      name: 'system-tests',
      testMatch: /.*\.system\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/system.json',
      },
      dependencies: ['auth-system'],
    },

    // Marketplace cross-org tests — use inline login() (no storageState dep), so
    // no auth-setup dependency. Previously matched NO project → silently skipped
    // (v4.18.0 P4-1). The check-e2e-coverage guard now fails CI if any spec is
    // unmatched, so this can never silently regress again.
    {
      name: 'marketplace-tests',
      testMatch: /marketplace\..*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      // The cross-org flow is a single long test (publish + 16 theme screenshots
      // + inquire + convert + settlement + DB asserts) — far more than the 30s
      // global per-test timeout. It was silently skipped before P4-1, so this was
      // never surfaced. Give the project a generous per-test budget.
      timeout: 180_000,
    },
  ],

  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
