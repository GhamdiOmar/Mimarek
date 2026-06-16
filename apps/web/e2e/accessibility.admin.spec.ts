import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Automated axe-core accessibility scan — Admin role.
 *
 * Implements design-system §6.17 requirement:
 *   "axe-core via @axe-core/react in dev mode" → now also enforced at E2E level.
 *
 * Coverage:
 *   Five key dashboard routes, exercised under the admin storageState
 *   (admin@mimaric.sa / mimaric2026 — seeded as ADMIN tenant user).
 *
 * Violation threshold:
 *   Currently filtered to "critical" and "serious" impact only, so the suite
 *   can land without requiring every pre-existing moderate/minor issue to be
 *   fixed first. Tighten by removing the `.withRules` / impact filter once the
 *   backlog is clear — just assert `violations.length === 0` without filtering.
 *
 * Auth pattern:
 *   Reuses the pre-authenticated storageState written by `auth.admin.setup.ts`
 *   (project "admin-tests" in playwright.config.ts), identical to every other
 *   *.admin.spec.ts in this suite.  No extra login steps needed here.
 */

// Routes covered by this scan — ALL tenant dashboard routes (CX-017 expansion:
// was 5 key routes, now the full tenant surface the ADMIN role can reach).
// Platform (/dashboard/admin/*) routes are covered separately by the system
// role in accessibility.system.spec.ts.
const ROUTES = [
  { path: "/dashboard", label: "Dashboard home" },
  { path: "/dashboard/crm", label: "CRM" },
  { path: "/dashboard/units", label: "Units" },
  { path: "/dashboard/reservations", label: "Reservations" },
  { path: "/dashboard/contracts", label: "Contracts" },
  { path: "/dashboard/payments", label: "Payments" },
  { path: "/dashboard/finance", label: "Finance" },
  { path: "/dashboard/leasing", label: "Leasing" },
  { path: "/dashboard/maintenance", label: "Maintenance" },
  { path: "/dashboard/marketplace", label: "Marketplace" },
  { path: "/dashboard/reports", label: "Reports" },
  { path: "/dashboard/documents", label: "Documents" },
  { path: "/dashboard/billing", label: "Billing" },
  { path: "/dashboard/settings", label: "Settings" },
  { path: "/dashboard/help", label: "Help" },
  { path: "/dashboard/notifications", label: "Notifications" },
] as const;

// Impact levels that gate CI.  Add "moderate" and "minor" here once the
// backlog of lower-severity issues has been worked through.
const BLOCKING_IMPACT = ["critical", "serious"] as const;

// v4.29.0 — the four QA-FE-01/FE-03 a11y-debt rules are FIXED and UN-BASELINED
// (verified clean by a live axe scan across all tenant + system routes):
//   • aria-allowed-attr — the AppTopbar notifications Popover trigger now wraps the real
//                         <button> IconButton (was PopoverTrigger asChild → <span>).
//   • color-contrast    — added `--info-strong` / `--warning-strong` tokens for text-on-tint
//                         badges (mirrors v4.20's `--success-strong`).
//   • select-name       — flagged native <select>s migrated to <SelectField> or given aria-label.
//   • label             — flagged inputs use the governed <Field> (useId + htmlFor) or sr-only
//                         labels; htmlFor/id added where simpler.
// The gate now enforces EVERY critical/serious WCAG 2.1 A/AA rule across the full surface.
const KNOWN_BASELINE_RULES: string[] = [];

test.describe("Accessibility — axe-core WCAG 2.1 A/AA (Admin)", () => {
  for (const route of ROUTES) {
    test(`${route.label} (${route.path}) — zero critical/serious violations`, async ({
      page,
    }) => {
      // Navigate and wait until all network activity settles so that
      // dynamically-rendered content is included in the axe scan.
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");

      // Suppress the first-run coachmark overlay so it doesn't interfere
      // with the scan (same pattern used by billing.page.ts navigateToBillingViaNav).
      await page.evaluate(() =>
        localStorage.setItem("mimaric.circlemenu.coachmark.v1", "1"),
      );

      const results = await new AxeBuilder({ page })
        // WCAG 2.1 Level A and Level AA — matches §6.17 "WCAG 2.2 AA" intent;
        // axe tags "wcag21a" + "wcag21aa" cover the superset of 2.0 + 2.1 rules.
        // "wcag22aa" can be added here once axe fully supports 2.2 criteria.
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        // Exclude the documented pre-existing baseline (see KNOWN_BASELINE_RULES).
        .disableRules(KNOWN_BASELINE_RULES)
        .analyze();

      // Filter down to blocking impact levels only.
      const blockingViolations = results.violations.filter(
        (v) => v.impact != null && (BLOCKING_IMPACT as readonly string[]).includes(v.impact),
      );

      // Produce a readable failure message that names every violation.
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
        console.error(
          `\n─── axe violations on ${route.path} ───\n${summary}\n`,
        );
      }

      expect(blockingViolations).toHaveLength(0);
    });
  }
});
