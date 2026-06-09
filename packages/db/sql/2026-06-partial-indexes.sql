-- Partial / conditional indexes that Prisma's schema DSL cannot express.
-- Apply manually after `prisma db push` on every environment (dev + prod-like).
-- Idempotent: safe to re-run.
--
-- See AGENTS.md §4 (schema procedure) and future-plans/audit-remediation.md (C1).

-- C1 — Reservation race: defense-in-depth DB invariant.
-- Guarantees at most one active (PENDING/CONFIRMED) reservation per unit, even if the
-- application-layer compare-and-swap is ever bypassed. The application CAS in
-- createReservation remains the primary guard; this index is the backstop.
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_unit_active_reservation"
  ON "Reservation" ("unitId")
  WHERE status IN ('PENDING', 'CONFIRMED');
