-- ═══════════════════════════════════════════════════════════════════════════
-- MIMARIC — Row Level Security (RLS) Setup
-- Run after `prisma db push` in Supabase SQL Editor (Dashboard → SQL Editor → New query),
-- on every environment (production + any long-lived staging DB).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- STRATEGY
-- --------
-- Mimaric is a pure server-side app (Next.js + Prisma). All database access
-- goes through the `postgres` role via the Supabase connection pooler. That role
-- OWNS these tables and therefore bypasses RLS automatically — no policies are
-- needed for the app to function.
--
-- Enabling RLS without permissive policies achieves two goals:
--   1. Silences the Supabase security advisor (`rls_disabled_in_public`).
--   2. Denies all PostgREST (anon / authenticated) access by default, closing the
--      auto-generated REST API surface to unauthenticated or client-side queries.
--      The public `NEXT_PUBLIC_SUPABASE_ANON_KEY` cannot read or write any row.
--
-- If a future feature requires direct Supabase client access (e.g. realtime
-- subscriptions, public marketplace served via PostgREST), add explicit policies
-- for ONLY those tables at that time — never a blanket permissive policy.
--
-- EXPECTED ADVISOR NOISE — DO NOT "FIX": after this runs, the Supabase advisor
-- reports `rls_enabled_no_policy` (INFO) on every table here. That is the intended
-- state — RLS-on + no-policy IS the firewall. DO NOT silence it by adding a
-- permissive policy (`USING (true)`); that re-opens the PostgREST/anon surface and
-- undoes the whole point. The owner (`postgres`) already bypasses RLS, so the app
-- needs no policy to function. Accept the INFO; never trade it for a policy.
--
-- DO NOT use ALTER TABLE ... FORCE ROW LEVEL SECURITY — that forces the owning
-- `postgres` role through policies that don't exist, which would break every
-- Prisma query. ENABLE (not FORCE) is the firewall; the owner still bypasses it.
--
-- Idempotent: `ENABLE ROW LEVEL SECURITY` is a no-op when already enabled, and
-- `IF EXISTS` skips tables absent on a given environment. Safe to re-run.
--
-- COVERAGE CONTRACT: this file must list EVERY table in schema.prisma plus the
-- implicit M2M join table(s) and Prisma's internal table. When you add a model,
-- add its table here in the same change (AGENTS.md §4).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Core identity ────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS "Organization"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "User"                      ENABLE ROW LEVEL SECURITY;

-- ── Property inventory ───────────────────────────────────────────────────────
ALTER TABLE IF EXISTS "Unit"                      ENABLE ROW LEVEL SECURITY;

-- ── CRM ──────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS "Customer"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "CustomerActivity"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "CustomerPropertyInterest"  ENABLE ROW LEVEL SECURITY; -- model Deal (@@map)

-- ── Sales & reservations ─────────────────────────────────────────────────────
ALTER TABLE IF EXISTS "Reservation"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ReservationExtension"      ENABLE ROW LEVEL SECURITY;

-- ── Contracts ────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS "Contract"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ContractTemplate"          ENABLE ROW LEVEL SECURITY;

-- ── Payment plans ────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS "PaymentPlan"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "PaymentPlanInstallment"    ENABLE ROW LEVEL SECURITY;

-- ── Leasing ──────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS "Lease"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "RentInstallment"           ENABLE ROW LEVEL SECURITY;

-- ── Documents ────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS "Document"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "DocumentVersion"           ENABLE ROW LEVEL SECURITY;

-- ── Maintenance ──────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS "MaintenanceRequest"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "PreventiveMaintenancePlan" ENABLE ROW LEVEL SECURITY;

-- ── Platform operations ──────────────────────────────────────────────────────
ALTER TABLE IF EXISTS "AuditLog"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Notification"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "PasswordResetToken"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "PermissionRequest"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "SupportTicket"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "TicketMessage"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Invitation"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "JoinRequest"               ENABLE ROW LEVEL SECURITY;

-- ── Commercialization ────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS "Plan"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "PlanEntitlement"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Subscription"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "SubscriptionEvent"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "SubscriptionMrrSnapshot"   ENABLE ROW LEVEL SECURITY; -- added 2026-06
ALTER TABLE IF EXISTS "EntitlementOverride"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Invoice"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "InvoiceLineItem"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "PaymentTransaction"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "PaymentMethod"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "GatewayConfig"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "WebhookEvent"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Coupon"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "CouponRedemption"          ENABLE ROW LEVEL SECURITY;

-- ── Marketplace (secondary-market unit transfers) ────────────────────────────
ALTER TABLE IF EXISTS "MarketplaceListing"        ENABLE ROW LEVEL SECURITY; -- added 2026-06
ALTER TABLE IF EXISTS "MarketplaceInquiry"        ENABLE ROW LEVEL SECURITY; -- added 2026-06
ALTER TABLE IF EXISTS "UnitTransferTransaction"   ENABLE ROW LEVEL SECURITY; -- added 2026-06

-- ── Infrastructure / counters ────────────────────────────────────────────────
ALTER TABLE IF EXISTS "SequenceCounter"           ENABLE ROW LEVEL SECURITY; -- added 2026-06
ALTER TABLE IF EXISTS "RateLimitCounter"          ENABLE ROW LEVEL SECURITY; -- added 2026-06

-- ── System configuration ─────────────────────────────────────────────────────
ALTER TABLE IF EXISTS "SystemConfig"              ENABLE ROW LEVEL SECURITY;

-- ── Implicit many-to-many join tables ────────────────────────────────────────
ALTER TABLE IF EXISTS "_CouponPlans"              ENABLE ROW LEVEL SECURITY; -- Plan ↔ Coupon

-- ── Prisma internal ──────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS "_prisma_migrations"        ENABLE ROW LEVEL SECURITY; -- added 2026-06

-- ── Verification (optional) — every public table should report relrowsecurity = true ──
-- SELECT relname, relrowsecurity
-- FROM pg_class
-- WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
-- ORDER BY relrowsecurity, relname;
