# Session Inactivity Timeout Gap - Action Plan

Created: 2026-06-30  
Status: **Phase 1 SHIPPED v5.31.0** (2026-07-01) — client-side idle guard, role-based
timeouts, bilingual warning modal, cross-tab sign-out, `?reason=idle` login banner.
**Phases 2 (server-enforced idle TTL) and 3 (admin-configurable policy) remain DEFERRED**
(see `REMAINING-WORK.md` § A) — this doc is retained as their design reference.  
Gap ID: `SEC-IDLE-001`  
Scope: Documentation only. No code changes in this plan.

## Executive Summary

Mimarek currently expires authenticated sessions by JWT lifetime, not by user inactivity. The app has a 7-day JWT session max age and a 24-hour update age, plus strong revocation controls through `tokenVersion` and `isActive`, but it does not automatically sign out a user after a period with no keyboard, mouse, touch, navigation, or tab activity.

This is a security and privacy gap for a product that displays customer PII, rent/payment data, contracts, ZATCA documents, deed proof, marketplace transfer evidence, support tickets, and platform administration surfaces.

The recommended first implementation is an authenticated-layout idle guard with a warning countdown, bilingual UI, cross-tab coordination, and current-browser sign-out. A later hardening phase can add server-enforced idle expiry if Mimarek needs protection against stolen but otherwise valid JWTs.

## Current Behavior

| Area | Current state | Evidence |
| --- | --- | --- |
| Session strategy | JWT session. | `apps/web/auth.ts` |
| Session lifetime | 7-day max age, 24-hour update age. | `session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 }` |
| Revocation | `tokenVersion` mismatch or inactive user rejects server actions. | `apps/web/lib/auth-helpers.ts` |
| Sign out everywhere | Bumps `tokenVersion`, invalidating outstanding sessions. | `apps/web/app/actions/sessions.ts` |
| Deactivation | Deactivating a user bumps `tokenVersion`. | `apps/web/app/actions/team.ts` |
| Client session provider | Uses server-side session prop; no periodic session polling on mount. | `apps/web/components/SimpleSessionProvider.tsx` |
| Idle tracking | No confirmed mouse/keyboard/touch/visibility idle timer. | Repo search for `idle`, `visibilitychange`, `mousemove`, `setInterval`, `signOut` in session shell. |

## Gap Statement

Mimarek does not currently enforce an inactivity timeout that signs out a user after a configurable period with no interaction.

Practical implication: a user can leave a dashboard, portal, admin page, CRM record, payments table, invoice page, deed proof page, or maintenance/support screen open on a shared or unattended device. The session remains valid until JWT expiry, explicit sign-out, user deactivation, password/session revocation, or another server-side rejection event.

## Risk

| Risk | Severity | Why it matters |
| --- | --- | --- |
| Unattended dashboard exposure | High | Customer PII, payment state, contracts, invoices, and maintenance records may remain visible. |
| Platform admin exposure | High | Admin, ZATCA, marketplace moderation, billing, data retention, and support surfaces are higher impact. |
| Shared workstation risk | High | Real estate offices often use shared devices at reception, sales desks, or maintenance offices. |
| Compliance posture gap | Medium | Inactivity timeout is a common enterprise expectation for systems handling PII and financial data. |
| User expectation mismatch | Medium | Users may assume closing a laptop or leaving a tab idle reduces access risk. |

## Recommended Policy

Initial default policy:

| Audience / role group | Idle timeout | Warning before timeout | Notes |
| --- | --- | --- | --- |
| Platform roles: `SYSTEM_ADMIN`, `SYSTEM_SUPPORT` | 15 minutes | 2 minutes | Higher-risk surfaces. |
| Finance and admin-heavy tenant roles: `ADMIN`, `MANAGER`, `FINANCE` | 30 minutes | 2 minutes | Includes payments, reports, ZATCA config, billing, team, and audit. |
| Operational tenant roles: `AGENT`, `LEASING`, `TECHNICIAN` | 45 minutes | 2 minutes | Still protects PII and operational data, but less disruptive for field workflows. |
| Basic tenant/resident role: `USER` | 60 minutes | 2 minutes | Lower privilege, still protected. |

Decision needed: confirm whether Mimarek wants one global timeout for simplicity, or role-based defaults for stronger risk alignment.

## Product Requirements

| ID | Requirement | Priority | Notes |
| --- | --- | --- | --- |
| IDLE-001 | Authenticated users are signed out after configured inactivity duration. | Must | Applies to `/dashboard/**` and `/portal/**`. |
| IDLE-002 | Show a bilingual warning dialog before timeout. | Must | Arabic/English with RTL/LTR support. |
| IDLE-003 | Warning dialog includes "Stay signed in" and "Sign out now". | Must | Stay signed in resets idle timer. |
| IDLE-004 | On timeout, sign out the current browser session and redirect to login with reason. | Must | Example: `/auth/login?reason=idle`. |
| IDLE-005 | Activity in one tab extends the session for all tabs in the same browser profile. | Must | Use `BroadcastChannel` or localStorage event. |
| IDLE-006 | Timeout in one tab signs out all open Mimarek tabs in that browser profile. | Must | Avoid stale visible screens. |
| IDLE-007 | Timer handles sleeping laptops and suspended tabs. | Must | On `visibilitychange`, `focus`, and route change, compare `Date.now()` against last activity timestamp. |
| IDLE-008 | Activity events are throttled. | Must | Avoid excessive re-renders or storage writes. |
| IDLE-009 | Modal is accessible. | Must | Focus trap, keyboard actions, `role="dialog"`, `aria-live` countdown. |
| IDLE-010 | UI copy explains that timeout is for account protection. | Should | Avoid alarming users. |
| IDLE-011 | Best-effort audit event records idle sign-out. | Should | Do not block sign-out if audit write fails. |
| IDLE-012 | Timeout values are configurable by role or environment. | Should | Start with constants; later promote to system config if needed. |
| IDLE-013 | Release includes light/dark and Arabic/English verification. | Must | Required for Mimarek UI changes. |

## Technical Direction

### Phase 1 - Client-Side Idle Guard

Add a client component under authenticated layouts:

- Dashboard shell: `apps/web/app/dashboard/DashboardClientLayout.tsx`
- Portal shell: `apps/web/app/portal/layout.tsx` or equivalent client wrapper

Responsibilities:

- Track user activity events: `pointerdown`, `keydown`, `wheel`, `touchstart`, route changes, and focused window activity.
- Persist `lastActivityAt` in memory and shared browser storage.
- Coordinate tabs with `BroadcastChannel("mimarek-session-idle")` or localStorage events.
- Show warning modal at `timeout - warningDuration`.
- On timeout:
  - Broadcast timeout to all tabs.
  - Clear visible session state where possible.
  - Call NextAuth sign-out for the current browser session.
  - Redirect to `/auth/login?reason=idle`.

Important limit: this phase is a browser-side privacy control. It clears the current browser session after inactivity, but it does not create a server-side idle TTL for stolen JWTs.

### Phase 2 - Server-Enforced Idle Expiry

If Mimarek needs stronger security, add server-side enforcement. Because the app uses JWT sessions, a true server-side idle timeout needs additional state.

Options:

| Option | Pros | Cons |
| --- | --- | --- |
| Add session activity table keyed by token/session id | Strong idle enforcement and auditability. | Requires adding a session identifier and DB lookup on protected requests. |
| Move to database session strategy | Native server-side session revocation and expiry model. | Larger auth architecture change. |
| Add `lastActivityAt` to JWT only | Simple. | Not strong server enforcement unless every request refreshes/signs token safely. |

Recommended phase 2 direction: session activity table or database session strategy only if enterprise/security requirements justify it.

### Phase 3 - Admin Configuration

Later enhancement:

- Platform admin can set default timeout policy.
- Tenant admin can choose stricter org-level timeout within platform limits.
- Role-specific overrides are visible in settings.
- Audit logs record policy changes.

## UX Copy

English warning:

> You have been inactive for a while. For security, Mimarek will sign you out in 2 minutes.

Actions:

- Stay signed in
- Sign out now

Arabic warning:

> لم يتم رصد أي نشاط منذ فترة. لحماية حسابك، سيقوم معمارك بتسجيل خروجك خلال دقيقتين.

Actions:

- البقاء مسجلاً
- تسجيل الخروج الآن

Login reason copy:

English:

> You were signed out after a period of inactivity.

Arabic:

> تم تسجيل خروجك بسبب عدم النشاط لفترة.

## Non-Goals

- Do not replace existing 7-day JWT session expiry in the first phase.
- Do not invalidate all user devices for normal idle timeout.
- Do not use `tokenVersion` for ordinary idle logout because it signs out every device.
- Do not apply idle timeout to public auth pages, marketing pages, password reset, email verification, or invite acceptance.
- Do not block sign-out on audit/logging failures.

## Implementation Plan

### Step 1 - Product Decision

- Confirm default timeout policy:
  - Simple global timeout: 30 minutes for all authenticated users.
  - Role-based timeout: recommended table above.
- Confirm whether portal `USER` accounts should use the same policy or longer timeout.
- Confirm whether platform admin/support should be stricter.

### Step 2 - Build Client Guard

- Create an idle-session component/hook.
- Mount it only inside authenticated dashboard and portal layouts.
- Track activity with throttling.
- Handle sleeping laptop and background-tab resume.
- Add cross-tab sync.
- Add bilingual warning modal.
- Sign out current browser session on timeout.

### Step 3 - Add Audit And Login Reason

- Add best-effort server action for `SESSION_IDLE_TIMEOUT` audit event if appropriate.
- Add login page handling for `reason=idle`.
- Keep failure modes safe: timeout still signs out if audit fails.

### Step 4 - Tests

- Unit tests for idle timer behavior with fake timers.
- Unit tests for warning countdown and "Stay signed in".
- Unit tests for cross-tab broadcast events.
- Playwright tests with shortened timeout:
  - user is warned before timeout,
  - "Stay signed in" resets timer,
  - timeout redirects to login,
  - sensitive page content is no longer visible after timeout,
  - Arabic and English copy render,
  - platform admin timeout path works.

### Step 5 - Release Verification

Because this touches authenticated UI and auth behavior, release verification must include:

- `npm run build`
- desktop and mobile viewport checks
- light and dark mode
- Arabic and English
- dashboard, portal, and platform admin routes
- console check with zero errors
- screenshots of warning modal and post-timeout login reason

## Acceptance Criteria

- After configured inactivity, an authenticated user is signed out from the current browser session.
- Warning modal appears before timeout and is accessible by keyboard.
- "Stay signed in" extends the session without page reload.
- "Sign out now" signs out immediately.
- Open tabs coordinate: activity in one tab resets all tabs, timeout in one tab signs out all tabs.
- On wake from sleep or return to a stale hidden tab, timeout is enforced immediately if idle duration has elapsed.
- No unauthenticated/public route is affected.
- Existing `tokenVersion` revocation and user deactivation behavior continue to work.
- Tests cover timer, warning, timeout, cross-tab, and representative UI flows.

## Open Questions

| Question | Owner |
| --- | --- |
| Should timeout be global or role-based? | Founder/Product/Security |
| Should platform staff always use 15 minutes? | Founder/Security |
| Should tenant organizations be able to configure stricter timeouts? | Product |
| Should idle timeout be part of plan entitlements or enterprise policy? | Product/GTM |
| Is client-side idle timeout sufficient for the first release, or is server-enforced idle expiry required? | Security/Engineering |

## Recommended Next Step

Approve Phase 1 as a small security hardening feature:

- role-based defaults,
- 2-minute warning modal,
- authenticated dashboard and portal coverage,
- cross-tab coordination,
- current-browser sign-out only,
- no `tokenVersion` mutation for ordinary idle timeout.

This closes the user-visible privacy gap without changing the auth architecture. A server-enforced idle expiry can be planned separately if Mimarek needs enterprise-grade session control beyond browser inactivity logout.

