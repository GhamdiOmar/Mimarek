import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Automated axe-core accessibility scan — SYSTEM (platform staff) role.
 *
 * CX-017: completes the "all routes × system + tenant" coverage. The tenant
 * surfaces are scanned in accessibility.admin.spec.ts under the ADMIN role; this
 * spec scans the platform (/dashboard/admin/*) surfaces under the SYSTEM_ADMIN
 * role, which a tenant user can never reach (§8 audience separation).
 *
 * Auth: reuses the pre-authenticated storageState from auth.system.setup.ts
 * (project "system-tests" in playwright.config.ts).
 */

const ROUTES = [
  { path: "/dashboard/admin", label: "Platform admin home" },
  { path: "/dashboard/admin/tickets", label: "Support tickets" },
  { path: "/dashboard/admin/seo", label: "SEO" },
  { path: "/dashboard/admin/email", label: "Email" },
  { path: "/dashboard/admin/marketplace", label: "Marketplace moderation" },
  { path: "/dashboard/admin/coupons", label: "Coupons" },
  { path: "/dashboard/admin/subscriptions", label: "Subscriptions" },
  { path: "/dashboard/notifications", label: "Notifications (shared)" },
] as const;

const BLOCKING_IMPACT = ["critical", "serious"] as const;

// Same documented pre-existing a11y debt baseline as the tenant scan (see
// accessibility.admin.spec.ts for the rationale): a Radix asChild aria-allowed-attr,
// remaining color-contrast instances (success badge fixed in v4.20; others pending the
// §6.2 follow-up), native <select> with no accessible name (QA-FE-03), and a few inputs
// missing a <label> (QA-FE-01). The gate enforces every other rule on the platform routes.
const KNOWN_BASELINE_RULES = ["aria-allowed-attr", "color-contrast", "select-name", "label"];

test.describe("Accessibility — axe-core WCAG 2.1 A/AA (System)", () => {
  for (const route of ROUTES) {
    test(`${route.label} (${route.path}) — zero critical/serious violations`, async ({
      page,
    }) => {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      await page.evaluate(() =>
        localStorage.setItem("mimaric.circlemenu.coachmark.v1", "1"),
      );

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .disableRules(KNOWN_BASELINE_RULES)
        .analyze();

      const blockingViolations = results.violations.filter(
        (v) => v.impact != null && (BLOCKING_IMPACT as readonly string[]).includes(v.impact),
      );

      if (blockingViolations.length > 0) {
        const summary = blockingViolations
          .map(
            (v) =>
              `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
              v.nodes
                .slice(0, 3)
                .map((n) => `  → ${n.html.slice(0, 120)}`)
                .join("\n"),
          )
          .join("\n\n");

        expect.soft(blockingViolations).toHaveLength(0);
        console.error(`\n─── axe violations on ${route.path} ───\n${summary}\n`);
      }

      expect(blockingViolations).toHaveLength(0);
    });
  }
});
