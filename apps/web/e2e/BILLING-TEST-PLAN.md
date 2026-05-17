# Mimaric SaaS Commercialization — E2E Test Plan

> **All tests are UI-based (Playwright E2E)**
> Actions that cannot be performed through the current UI are marked with 🔧 for future enhancement.

---

## Prerequisites

```bash
# 1. Seed test data (plans, coupons, invoices, payment methods)
npx tsx e2e/seed/billing-seed.ts

# 2. Run tests
npx playwright test billing.admin.spec.ts
```

### Test Data Created by Seed

| Type | Items | Details |
|------|-------|---------|
| Plans | 3 | Starter (free), Professional (499/mo), Enterprise (1499/mo) |
| Coupons | 6 | WELCOME20 (20%), SAVE100 (100 SAR), EXPIRED2024, INACTIVE50, MAXED, PROONLY30 |
| Subscription | 1 | TRIALING, Professional, Annual |
| Invoices | 3 | INV-2026-00001 (PAID), INV-2026-00002 (ISSUED), INV-2026-00003 (OVERDUE) |
| Payment Method | 1 | Mada ****4321 |
| Gateway | 1 | Moyasar (primary) |

---

## Test Scenarios

### TC-01: Trial Simulation

| # | Test Case | UI Action | Expected Result | Status |
|---|-----------|-----------|-----------------|--------|
| 1.1 | Start free trial | Go to Plans page → Click "Start Free Trial" on Professional | Subscription created with TRIALING status | ✅ UI |
| 1.2 | Trial status visible | Go to Billing Dashboard | Shows "Free Trial" badge + trial end date | ✅ UI |
| 1.3 | Trial countdown | Go to Billing Dashboard | Trial end date displayed (14 days from now) | ✅ UI |
| 1.4 | Trial expiry → ACTIVE | 🔧 Trigger `expireTrials()` cron | With payment method: transitions to ACTIVE | 🔧 Needs cron trigger UI or admin action |
| 1.5 | Trial expiry → CANCELED | 🔧 Trigger `expireTrials()` cron (no payment method) | Without payment method: transitions to CANCELED | 🔧 Needs cron trigger UI or admin action |
| 1.6 | Trial notification (3 days before) | 🔧 Trigger `notifyTrialEnding()` | In-app notification shown | 🔧 Needs notification center UI |

### TC-02: Payment Simulation (Moyasar)

| # | Test Case | UI Action | Expected Result | Status |
|---|-----------|-----------|-----------------|--------|
| 2.1 | Payment method displayed | Go to Billing Dashboard | Shows Mada ****4321 with "Default" badge | ✅ UI |
| 2.2 | Add payment method | 🔧 Click "Add Payment Method" → Moyasar form | Card tokenized and saved | 🔧 Needs "Add Payment Method" button + Moyasar form integration |
| 2.3 | Set default payment method | 🔧 Click on non-default card → "Set as Default" | Default badge moves to selected card | 🔧 Needs payment method management UI |
| 2.4 | Delete payment method | 🔧 Click "Delete" on a saved card | Card removed from list | 🔧 Needs delete button on payment method cards |
| 2.5 | Payment succeeds (webhook) | 🔧 Simulate `payment.paid` webhook | Invoice → PAID, Subscription → ACTIVE | 🔧 Backend webhook — no UI trigger |
| 2.6 | Payment fails (webhook) | 🔧 Simulate `payment.failed` webhook | Subscription → PAST_DUE, dunning begins | 🔧 Backend webhook — no UI trigger |

### TC-03: Dunning & Past-Due Flow

| # | Test Case | UI Action | Expected Result | Status |
|---|-----------|-----------|-----------------|--------|
| 3.1 | Past-due warning banner | Go to Billing Dashboard (PAST_DUE subscription) | Yellow banner: "Payment past due" + "Update Payment" button | ✅ UI |
| 3.2 | Update payment from banner | Click "Update Payment" on past-due banner | 🔧 Navigates to payment method update | 🔧 Button exists but needs target page |
| 3.3 | Dunning retry schedule | 🔧 Trigger `processDunning()` cron | Retries at 1d, 3d, 7d intervals | 🔧 Needs cron trigger UI or admin action |
| 3.4 | Dunning exhausted → UNPAID | 🔧 Trigger after 3 failed retries | Subscription → UNPAID, read-only mode | 🔧 Needs cron trigger |
| 3.5 | Manual retry payment | 🔧 Click "Retry Payment" on PAST_DUE subscription | Charges saved payment method | 🔧 Needs "Retry Payment" button on billing page |

### TC-04: Usage Limits & Entitlement Gating

| # | Test Case | UI Action | Expected Result | Status |
|---|-----------|-----------|-----------------|--------|
| 4.2 | User limit enforced | Invite users up to plan limit (Starter: 5) | 6th invite blocked with error | ✅ UI (via team invitation) |
| 4.3 | Unit limit enforced | Create units up to plan limit (Starter: 50) | 51st unit blocked with error | ✅ UI (via unit creation form) |
| 4.4 | CMMS access gated | Navigate to CMMS on Starter plan | Access denied / upgrade prompt | 🔧 Needs upgrade prompt UI (currently just server-side block) |
| 4.6 | Usage meter display (80%) | Reach 80% of unit limit | 🔧 Dashboard shows usage meter at 80% | 🔧 Needs usage meters on dashboard sidebar |
| 4.7 | Usage meter display (100%) | Reach 100% of limit | 🔧 Dashboard shows red "Limit reached" | 🔧 Needs usage meters on dashboard sidebar |

### TC-05: Access Restriction (No Payment / Canceled)

| # | Test Case | UI Action | Expected Result | Status |
|---|-----------|-----------|-----------------|--------|
| 5.1 | CANCELED → billing redirect | Navigate to /dashboard with CANCELED subscription | Redirected to /dashboard/billing | ✅ UI (middleware check) |
| 5.2 | UNPAID → billing redirect | Navigate to /dashboard with UNPAID subscription | Redirected to /dashboard/billing | ✅ UI (middleware check) |
| 5.3 | Read-only mode | Try creating a project with CANCELED subscription | Write action blocked, shown "Reactivate" prompt | 🔧 Needs read-only overlay / reactivation UI |
| 5.4 | System roles bypass | Login as SYSTEM_ADMIN → navigate dashboard | Dashboard loads without subscription check | ✅ UI |
| 5.5 | Resubscribe after cancel | Go to Plans page → Subscribe | New subscription created, access restored | ✅ UI |

### TC-06: Billing Validation (VAT & Invoice Format)

| # | Test Case | UI Action | Expected Result | Status |
|---|-----------|-----------|-----------------|--------|
| 6.1 | Invoice number format | Go to Invoices page | Numbers follow INV-YYYY-XXXXX format | ✅ UI |
| 6.2 | VAT column (15%) | Go to Invoices page | VAT (15%) column visible with correct amounts | ✅ UI |
| 6.3 | Subtotal + VAT = Total | Go to Invoices page | Math validates: subtotal × 1.15 = total | ✅ UI |
| 6.4 | SAR currency display | Go to Invoices page | All amounts show "ر.س" or "SAR" | ✅ UI |
| 6.5 | Invoice status badges | Go to Invoices page | Color-coded badges: PAID (green), ISSUED (blue), OVERDUE (red) | ✅ UI |
| 6.6 | Invoice date formatting | Go to Invoices page | Dates formatted per locale (ar-SA / en-US) | ✅ UI |
| 6.7 | Invoice detail view | 🔧 Click invoice → detail page | Shows line items, payment transactions, ZATCA QR | 🔧 Needs invoice detail page /billing/invoices/[id] |
| 6.8 | Invoice PDF download | 🔧 Click download on invoice | PDF generated with ZATCA compliance | 🔧 Needs PDF generation endpoint |

### TC-07: System Admin Privileges

| # | Test Case | UI Action | Expected Result | Status |
|---|-----------|-----------|-----------------|--------|
| 7.1 | Admin sees "Change Plan" button | Login as COMPANY_ADMIN → Billing Dashboard | "Change Plan" button visible | ✅ UI |
| 7.2 | Non-admin cannot see billing | Login as TECHNICIAN → Navigate to /billing | Sidebar link hidden, page blocked | ✅ UI |
| 7.3 | FINANCE_OFFICER read-only | Login as FINANCE_OFFICER → Billing Dashboard | Can view but no "Change Plan" button | ✅ UI (billing:read only) |
| 7.4 | SYSTEM_ADMIN plan management | 🔧 Go to /admin/plans | CRUD plans + entitlements | 🔧 Needs admin plans UI page |
| 7.5 | SYSTEM_ADMIN coupon management | 🔧 Go to /admin/coupons | Create/toggle coupons | 🔧 Needs admin coupons UI page |
| 7.6 | SYSTEM_ADMIN subscription overview | 🔧 Go to /admin/subscriptions | View all org subscriptions | 🔧 Needs admin subscriptions UI page |
| 7.7 | SYSTEM_ADMIN entitlement override | 🔧 Go to /admin/overrides | Grant org-level exceptions | 🔧 Needs admin override UI |

### TC-08: ZATCA Sending Simulation

| # | Test Case | UI Action | Expected Result | Status |
|---|-----------|-----------|-----------------|--------|
| 8.1 | Invoice has ZATCA fields | 🔧 View invoice detail | zatcaStatus, zatcaHash, zatcaQrCode fields present | 🔧 Needs invoice detail page |
| 8.2 | ZATCA QR code display | 🔧 View invoice detail | QR code rendered on invoice | 🔧 Needs ZATCA QR component |
| 8.3 | ZATCA clearance status | 🔧 View invoice detail | Status: PENDING → CLEARED → REPORTED | 🔧 Needs ZATCA integration + status display |
| 8.4 | ZATCA XML generation | 🔧 Trigger invoice XML generation | XML stored on invoice record | 🔧 Needs ZATCA SDK integration |

### TC-09: VAT Requirements (15% Saudi)

| # | Test Case | UI Action | Expected Result | Status |
|---|-----------|-----------|-----------------|--------|
| 9.1 | VAT rate is 15% on all invoices | Go to Invoices page | All invoices show 15% VAT | ✅ UI |
| 9.2 | VAT calculated on subtotal | Check invoice amounts | vatAmount = subtotal × 0.15 | ✅ UI |
| 9.3 | VAT recalculated after coupon | Apply coupon → check invoice | VAT recalculated on discounted subtotal | 🔧 Need invoice detail with coupon discount display |
| 9.4 | Zero-price plan has no VAT | Check Starter plan invoice | Free plan → no VAT line | ✅ UI (no invoice generated for free plan) |

### TC-10: Coupon Application

| # | Test Case | UI Action | Expected Result | Status |
|---|-----------|-----------|-----------------|--------|
| 10.1 | Coupon input visible on plans page | Go to Plans page | Coupon input field and "Apply" button visible | ✅ UI |
| 10.2 | Valid coupon applied (WELCOME20) | Enter "WELCOME20" → Click Apply | Green success banner, 20% discount shown | ✅ UI |
| 10.3 | Fixed amount coupon (SAVE100) | Enter "SAVE100" → Click Apply | 100 SAR discount shown | ✅ UI |
| 10.4 | Invalid coupon code error | Enter "INVALIDXYZ" → Click Apply | Red error: "Invalid coupon code" | ✅ UI |
| 10.5 | Expired coupon error | Enter "EXPIRED2024" → Click Apply | Red error: "This coupon has expired" | ✅ UI |
| 10.6 | Inactive coupon error | Enter "INACTIVE50" → Click Apply | Red error: "This coupon is no longer active" | ✅ UI |
| 10.7 | Max-redemptions coupon error | Enter "MAXED" → Click Apply | Red error: "Maximum redemptions" | ✅ UI |
| 10.8 | Plan-specific coupon | Enter "PROONLY30" on Enterprise plan | Error: "Not valid for selected plan" | 🔧 Needs plan-specific validation on UI (currently validates without planId) |
| 10.9 | Coupon removal | Apply coupon → Click X to remove | Coupon removed, prices revert | ✅ UI |
| 10.10 | Strikethrough original price | Apply valid coupon | Original price shown with strikethrough | ✅ UI |
| 10.11 | "You save" amount displayed | Apply valid coupon | Shows total savings amount | ✅ UI |
| 10.12 | Empty coupon button disabled | Leave code empty | "Apply" button is disabled | ✅ UI |
| 10.13 | Submit via Enter key | Type code → Press Enter | Coupon validated | ✅ UI |
| 10.14 | Coupon on invoice | 🔧 Apply coupon to issued invoice | Invoice recalculated with discount | 🔧 Needs coupon application on invoice detail page |

### TC-11: Billing & Payment Reports

| # | Test Case | UI Action | Expected Result | Status |
|---|-----------|-----------|-----------------|--------|
| 11.1 | Invoice listing with pagination | Go to Invoices → Navigate pages | Correct items per page, page numbers | ✅ UI |
| 11.2 | Invoice filtering by status | 🔧 Filter invoices by PAID/ISSUED/OVERDUE | Filtered list shown | 🔧 Needs status filter dropdown on invoices page |
| 11.3 | Revenue dashboard (MRR/ARR) | 🔧 Go to /admin/revenue | Monthly/Annual recurring revenue charts | 🔧 Needs admin revenue dashboard page |
| 11.4 | Payment history | 🔧 Go to /billing/payments | Transaction log with gateway, status, amount | 🔧 Needs payment history page |
| 11.5 | Export invoices | 🔧 Click "Export" on invoices page | CSV/PDF export of invoice list | 🔧 Needs export button + endpoint |

### TC-12: Admin Plan Changes

| # | Test Case | UI Action | Expected Result | Status |
|---|-----------|-----------|-----------------|--------|
| 12.1 | Upgrade plan | Go to Plans → Click subscribe on higher plan | Plan upgraded, entitlements updated | ✅ UI (via changePlan server action) |
| 12.2 | Downgrade plan | Go to Plans → Click subscribe on lower plan | Plan downgraded at period end | ✅ UI |
| 12.3 | Current plan badge | Go to Plans | Active plan shows "Current Plan" disabled badge | ✅ UI |
| 12.4 | Cancel subscription | 🔧 Click "Cancel Subscription" on billing page | Subscription canceled with reason prompt | 🔧 Needs cancel button + confirmation dialog |
| 12.5 | Admin bulk plan change | 🔧 Go to /admin/subscriptions → Change org plan | Plan changed by admin for specific org | 🔧 Needs admin subscription management |

### TC-13: Notifications

| # | Test Case | UI Action | Expected Result | Status |
|---|-----------|-----------|-----------------|--------|
| 13.1 | Trial ending notification | 🔧 View notification center | "Trial ending in 3 days" message | 🔧 Needs notification center / bell icon |
| 13.2 | Payment succeeded notification | 🔧 View notification center | "Payment of X SAR successful" | 🔧 Needs notification center |
| 13.3 | Payment failed notification | 🔧 View notification center | "Payment failed, update method" | 🔧 Needs notification center |
| 13.4 | Invoice issued notification | 🔧 View notification center | "New invoice INV-XXXX issued" | 🔧 Needs notification center |
| 13.5 | Plan change notification | 🔧 View notification center | "Plan changed to Professional" | 🔧 Needs notification center |
| 13.6 | Usage limit 80% warning | 🔧 View notification center | "80% of project limit reached" | 🔧 Needs notification center |
| 13.7 | Usage limit 100% alert | 🔧 View notification center | "Project limit reached, upgrade" | 🔧 Needs notification center |

### TC-14: New Subscriber Alert

| # | Test Case | UI Action | Expected Result | Status |
|---|-----------|-----------|-----------------|--------|
| 14.1 | New org subscription alert | 🔧 Login as SYSTEM_ADMIN → Notifications | "New subscriber: Org X on Professional plan" | 🔧 Needs system admin notification feed |
| 14.2 | Subscriber count on admin dash | 🔧 Go to /admin/revenue | Total subscribers, new this month | 🔧 Needs admin revenue dashboard |
| 14.3 | Churn alert | 🔧 View admin notifications | "Org X canceled subscription" | 🔧 Needs admin notification system |

---

## UI Enhancements Required (🔧 Summary)

These items were identified during test planning as features that have backend support but no UI yet:

### High Priority
1. **Invoice Detail Page** — `/dashboard/billing/invoices/[id]` with line items, coupon, ZATCA QR
2. **Cancel Subscription Button** — On billing dashboard with confirmation dialog
3. **Payment Method Management** — Add/remove cards, Moyasar tokenization form
4. **Notification Center** — Bell icon + notification panel for billing alerts
5. **Admin Plans Page** — `/admin/plans` for CRUD plan management
6. **Admin Coupons Page** — `/admin/coupons` for coupon management
7. **Admin Subscriptions Page** — `/admin/subscriptions` for cross-org management

### Medium Priority
8. **Usage Meters** — Sidebar or dashboard showing limit usage (projects, users, units)
9. **Upgrade Prompt UI** — Inline CTA when entitlement denied (instead of error)
10. **Invoice Status Filter** — Dropdown filter on invoices list page
11. **Retry Payment Button** — On PAST_DUE billing dashboard
12. **Read-Only Mode Overlay** — For CANCELED/UNPAID subscriptions

### Low Priority
13. **Revenue Dashboard** — `/admin/revenue` with MRR/ARR/churn charts
14. **Payment History Page** — Transaction log with gateway details
15. **Invoice PDF Download** — Server-side PDF generation
16. **Invoice Export** — CSV/PDF bulk export
17. **ZATCA Integration UI** — QR code display, clearance status
18. **Cron Job Trigger** — Admin UI to manually trigger trial expiry / dunning

---

## Test Execution

```bash
# Run all billing tests
npx playwright test billing.admin.spec.ts

# Run specific test section
npx playwright test billing.admin.spec.ts -g "Coupon Application"

# Run with UI for debugging
npx playwright test billing.admin.spec.ts --ui

# Generate report
npx playwright test billing.admin.spec.ts --reporter=html
npx playwright show-report
```
