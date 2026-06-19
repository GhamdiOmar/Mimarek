import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const SHOT = path.join(process.cwd(), "e2e", "__screenshots__", "marketplace");

async function login(page: Page, email: string, pass: string) {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await page.getByRole("button", { name: /Login|تسجيل الدخول/i }).click();
  await page.waitForURL("**/dashboard**", { timeout: 20000 });
}

test("My Listings is reachable via a visible button on the marketplace page", async ({
  browser,
}) => {
  fs.mkdirSync(SHOT, { recursive: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, "admin@mimarek.sa", "mimaric2026");

  await page.goto("/dashboard/marketplace", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);

  const myListings = page.getByRole("link", { name: /إعلاناتي|My Listings/i });
  await expect(myListings.first()).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: path.join(SHOT, "browse-with-mylistings-button.png"), fullPage: true });

  await myListings.first().click();
  await page.waitForURL("**/dashboard/marketplace/my-listings", { timeout: 15000 });
  await page.waitForTimeout(3000);
  await expect(
    page.getByText(/إعلاناتي في السوق|My Marketplace Listings/i).first(),
  ).toBeAttached();
  const back = page.getByRole("link", { name: /العودة إلى السوق|Back to marketplace/i });
  await expect(back.first()).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: path.join(SHOT, "mylistings-with-back-link.png"), fullPage: true });

  await back.first().click();
  await page.waitForURL("**/dashboard/marketplace", { timeout: 15000 });
  await ctx.close();
});
