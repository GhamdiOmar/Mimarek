const { chromium } = require('playwright');
const path = require('path');

const OUT = path.join(__dirname, 'screenshots', 'shot-crm-form.png');

(async () => {
  // Use desktop viewport — click the header "إضافة عميل" button, avoids mobile FAB issues
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:3000/auth/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'admin@mimaric.sa');
  await page.fill('input[type="password"]', 'mimaric2026');
  await page.locator('button').filter({ hasText: /تسجيل الدخول/ }).first().click();
  await page.waitForURL('http://localhost:3000/dashboard', { timeout: 10000 });
  console.log('Logged in');

  await page.goto('http://localhost:3000/dashboard/crm');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Disable animations
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }'
  });

  // Click the desktop "إضافة عميل" / "Add Customer" button in the page header
  const addBtn = page.locator('button').filter({ hasText: /إضافة عميل|Add Customer|New Customer|إضافة/ }).first();
  await addBtn.click();
  console.log('Clicked add button');

  // Wait for the modal to be visible
  await page.waitForSelector('.fixed.inset-0', { state: 'attached', timeout: 5000 });
  await page.waitForTimeout(300);

  // Crop to just the modal
  const modalEl = page.locator('.fixed.inset-0');
  const innerModal = page.locator('.fixed.inset-0 > div').first();
  const box = await innerModal.boundingBox();
  console.log('Modal box:', box);

  await page.screenshot({
    path: OUT,
    clip: box ? { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } : undefined,
  });
  console.log('Saved:', OUT);
  await browser.close();
})();
