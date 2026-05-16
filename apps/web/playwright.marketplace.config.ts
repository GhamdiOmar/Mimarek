import { defineConfig, devices } from "@playwright/test";

/**
 * Isolated config for the marketplace cross-org E2E.
 * - Targets a dedicated server on :3100 (the repo default :3000 is held by
 *   another worktree; we must not test against foreign code).
 * - No managed webServer — the server is started externally.
 * - Single serial chromium project; the flow is stateful across steps.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /marketplace\.(cross-org|mylistings-link)\.spec\.ts/,
  timeout: 300 * 1000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-marketplace" }]],
  outputDir: "test-results-marketplace",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "off",
  },
  projects: [
    { name: "marketplace", use: { ...devices["Desktop Chrome"] } },
  ],
});
