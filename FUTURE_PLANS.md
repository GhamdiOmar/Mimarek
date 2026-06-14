# Mimaric — Future Plans & Roadmap

> **Status:** The journey-first transformation is **complete and live** (v4.7.0 shipped: PR #14 → `e8d878f`, tagged, released, post-merge `main` CI green). **Nothing in this document is implemented or in progress.** This is the canonical backlog/roadmap of *deliberately deferred* work, to be picked up when prerequisites are configured. Do **not** start any item here without an explicit go-ahead.
>
> Maintenance: significant future-work plans live here at the repo root (not only in the ephemeral session plan file). Items move out of this doc only when shipped (then they belong in CHANGELOG + release notes).

> **Companion handover docs:**
> - [`future-plans/QA-AUDIT-REMEDIATION.md`](future-plans/QA-AUDIT-REMEDIATION.md) — research-backed fix-plan for the full-repo QA & code audit (P0 security · P1 DB-under-Migrate · P2 a11y/architecture · P3 marketplace lawful redesign). DB items ride on §1 below; server-action item extends §2.1.
> - [`future-plans/CX-REMEDIATION-HANDOVER.md`](future-plans/CX-REMEDIATION-HANDOVER.md) — CX-audit remediation tracker (CX-001…CX-022).

---

# 1. Release & Database-Evolution Governance (PRIMARY — the big one)

## Why this exists

Mimaric is going **public** as a SaaS holding **money** (rent ledgers, contracts, payments) and **Saudi PII** (national IDs, phones — hashed + app-encrypted). Shipping v4.7.0 surfaced a structural release-safety gap:

- **No Prisma migration history** — schema reaches every environment via `prisma db push`.
- **No automated production deploy**, **no staging**, **no observability/rollback**.
- Production schema is changed by a human running `db push` by hand — the exact v4.7.0 near-miss (a v4.5.0 `NOT NULL @updatedAt` could not push onto 5 populated prod rows; fixed manually, 0 data loss verified — but only because real-DB verification was forced).

"We got lucky because someone checked by hand" is not a control for a money + regulated-PII product. This program defines a **repeatable, gated SDLC the developer (Claude Code) follows on every enhancement / bug-fix / feature → release**, plus the supporting infrastructure.

## Decisions already locked (Omar)

1. **Hosting:** not previously decided → **recommended: Vercel (GitHub-integrated) for `apps/web` + Supabase managed Postgres.**
2. **Database evolution:** **adopt Prisma Migrate now** — versioned migrations as source of truth, `migrate deploy` in CI/CD, one-time baseline of the drifted prod DB, retire prod `db push`.
3. **Scope:** **full enterprise SDLC** governance adopted now.
4. **Staging:** environment standup **deferred** to the roadmap; full governance/controls adopted now with an interim sanitized-clone rehearsal substitute.

## PREREQUISITES Omar must configure before any execution

- [ ] Vercel account + project linked to the GitHub repo (Production + Preview envs).
- [ ] Supabase: confirm prod project; create a **temporary/disposable** project for baseline rehearsal (no local Postgres on the dev machine).
- [ ] Prod **backup / PITR** access confirmed; a known restore point.
- [ ] Sentry account + DSN; uptime monitor account (Better Stack free tier or Sentry Crons).
- [ ] Decide error-tracking/uptime vendors if not the recommended defaults.
- [ ] Confirm Omar is sole holder of prod `DIRECT_URL` (break-glass / data-protection owner); Claude Code never holds unattended prod direct credentials.
- [ ] Vercel/CI secrets set: `DATABASE_URL` (pooled 6543, pgbouncer), `DIRECT_URL` (direct 5432), `AUTH_SECRET`, `PII_ENCRYPTION_KEY`, Sentry DSN.

## Single biggest risk

**Baselining the already-drifted, populated production DB onto Prisma Migrate.** Mis-baseline → `migrate deploy` re-runs DDL on money/PII tables → data loss. De-risked by: rehearse on a disposable PII-sanitized prod clone first; `migrate diff` must report **zero** drift before any prod touch; prod gets only `migrate resolve --applied` (metadata only, **no DDL**); atomic CI cutover.

---

## A. Per-change Developer Playbook (CENTERPIECE) → becomes AGENTS.md §3.10

Run for **every** change. Classify first; gates additive by tier.

- **Step 0 — Risk tier:** **T0** docs/copy/UI-only · **T1** logic (server actions, components, non-money/PII queries) · **T2** any `schema.prisma` edit · **T3** money/PII/security (rent-ledger-contract-payment math, PII encrypt/hash, NextAuth/authz, payment-webhook, cron). Tier = highest matched.
- **Step 1** branch off `main` (`<type>/<slug>`); never commit to `main`.
- **Step 2** implement to existing patterns (reuse before adding).
- **Step 3** verify (AGENTS §3.4 + §3.8): real `lint`/`check-types`/`build`/targeted Playwright; read actual output; personally re-verify any subagent absence/critical claim.
- **Step 4 — tier gates (additive):** T0 → §3.4 + cspell · T1 → + full affected Playwright + branch-coverage reasoning · T2 → + DB sub-flow + `prisma migrate diff` clean + `payment-correctness-test.ts` · T3 → + re-run `payment-correctness-test.ts` + auth/PII Playwright + local dep+secret scan + PDPL checklist (§E) + 2nd-pass review of money invariants (idempotency `@@unique`, Decimal, `paidAmount` written with `status`).
- **Step 5 — DB change sub-flow (T2/T3) — expand/contract decision tree:**
  - Additive (nullable col / new table / new index): index on large table → `CREATE INDEX CONCURRENTLY` (raw SQL, no txn); else single `migrate dev`.
  - New `NOT NULL` col → EXPAND: nullable + `@default` → deploy → batched backfill → set `NOT NULL` in a **later** migration.
  - New FK/CHECK → `ADD CONSTRAINT … NOT VALID` → deploy → `VALIDATE CONSTRAINT` (later migration).
  - Rename/narrow type on money|PII → 3-deploy parallel change: (1) add col + dual-write (2) backfill + read-new (3) drop old.
  - Drop col/table → grep refs → contract-only migration, never combined with an expand.
  - Pure semantic rename → prefer `@@map("OldName")` (cf. `Deal @@map("CustomerPropertyInterest")`). Generate via `cd packages/db && npx prisma migrate dev --name <slug>` against **DIRECT_URL**; hand-review SQL for money/PII tables. **Never combine expand + contract in one migration.**
- **Step 6** CI: push/PR; CI genuinely green on the *full* path (read logs per §3.9.1, not the badge).
- **Step 7** release gate (§3.9/§3.9.1): per-change = green full-path CI; the milestone preview-walk is satisfied by CI-full-path **+ post-deploy smoke (Step 9)** until staging exists.
- **Step 8** merge to `main` → pipeline auto-runs `migrate deploy` then app deploy.
- **Step 9 — post-deploy verified (money product — ALL five):** `/api/health` 200; zero new release-tagged Sentry errors 10 min; `prisma migrate status` up-to-date; one synthetic authenticated rent-ledger render with non-NaN totals; payment-webhook endpoint reachable.
- **Step 10 — rollback trigger:** health non-200 >2 min · Sentry spike · money/auth 5xx · `migrate status` mismatch → §C rollback.

## B. Database Evolution Policy + one-time prod baseline → rewrites AGENTS.md §4

**Policy:** `packages/db/prisma/migrations/` is the **single source of truth**. `migrate deploy` in CI and prod. `db push` only on a throwaway local scratch DB — never CI, never prod. Applied migrations immutable; fixes/hotfixes = a **new** migration. CI runs `prisma migrate status` (drift detector).

**Config fix (one atomic commit):**
- `packages/db/prisma.config.ts` → `datasource.url: process.env["DIRECT_URL"]` (migrations need direct 5432, not pgbouncer:6543).
- `packages/db/src/index.ts` → runtime pool stays pooled `DATABASE_URL`; add "migrations=DIRECT_URL, runtime=pooled" comment.
- `packages/db/package.json` → add `db:migrate:dev|deploy|status`; mark `db:push` "local scratch only".
- Add `DIRECT_URL` to CI job env + prod host env.

**One-time prod baseline runbook (strict order — the riskiest workstream):**
1. **Snapshot prod** (Supabase PITR/backup; record restore point) — Omar authorizes; he holds prod `DIRECT_URL`.
2. **Disposable clone:** restore backup into a **temporary Supabase project**, then **PII-sanitize** (null/scramble national IDs, phones; void encrypted blobs). This clone = rehearsal target + interim staging substitute.
3. **Author baseline:** `prisma/migrations/0_init/` via `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.
4. **Drift reconcile:** `migrate diff --from-url $CLONE_DIRECT_URL --to-schema-datamodel prisma/schema.prisma --script` → **must be empty**; fold any delta into baseline; repeat until empty.
5. **Rehearse on clone:** `migrate resolve --applied 0_init` → `migrate status` up-to-date → `migrate deploy` emits **zero DDL** → seeds + `payment-correctness-test.ts` pass → row counts unchanged.
6. **Prod baseline (metadata only):** point `DIRECT_URL` at prod → `migrate resolve --applied 0_init` (writes `_prisma_migrations`, **no DDL**) → `migrate status` clean → `migrate diff` prod-vs-schema empty.
7. **Atomic CI cutover (same PR as baseline):** `.github/workflows/ci.yml` replace `prisma db push --accept-data-loss` → `prisma migrate deploy`. Never a mixed push/deploy state across environments.
8. **Hotfix-drift rule:** an emergency hand-mutation of prod must be immediately captured as a migration and `migrate resolve --applied` on prod before the next deploy.

## C. Hosting + deploy pipeline + rollback (RECOMMENDED: Vercel + Supabase)

Vercel first-classes Next.js 16 App-Router/Server-Actions; **instant atomic rollback** (promote prior immutable deployment); automatic **PR preview deployments** (partially offsets deferred staging); built-in encrypted Production/Preview env separation. Prisma 7 + `@prisma/adapter-pg`: runtime → pooled `DATABASE_URL` (6543); migrations → `DIRECT_URL` (5432) in CI only.

**Pipeline (merge to `main`):** CI full-path (blocking) → `db-migrate` job: `prisma migrate deploy` [DIRECT_URL=prod] → Vercel build+deploy (gated to fire only after migrate success) → post-deploy `/api/health` + synthetic money-page check → success = atomic swap; failure = auto-rollback + page Omar.
**Ordering rule:** `migrate deploy` **before** app deploy; migrations expand/contract so the old running version tolerates the new schema during the swap.
**Rollback:** app = promote previous Vercel deployment (seconds). **DB caveat:** migrations forward-only; bad migration → **fix-forward** compensating migration; PITR restore only for data corruption as a declared manual incident.

## D. Observability & release safety → new AGENTS.md §8

- **Error tracking:** Sentry in `apps/web` (server+edge+client), `release`=git tag, `environment`=production, source maps in CI.
- **Health endpoint:** new `apps/web/app/api/health/route.ts` → 200 `{ db: SELECT 1, version, time }`.
- **Uptime/alerting:** external monitor on `/api/health`; SLIs = availability, money-path 5xx, p95 latency on ledger/payment routes, webhook failure rate → page Omar + Sentry release-regression alert.
- **Structured logging:** JSON (request id, hashed userId, route, latency); **never log raw PII or money identifiers**.

## E. Security & PDPL/NDMO controls → new AGENTS.md §9 (release-blocking)

- CI pre-prod gates (blocking): `npm audit --audit-level=high` (or Snyk); secret scan — keep GitGuardian + add `gitleaks` on the diff; CycloneDX **SBOM** as a release artifact.
- **Non-prod de-identification (hard rule):** raw Saudi PII in *any* non-prod DB (disposable clone, future staging, dev) is prohibited — national IDs/phones nulled/scrambled, encrypted blobs voided. Test seeds already synthetic — keep verified.
- **PDPL/NDMO checklist (T3, any "no" blocks release):** lawful basis/purpose-limitation unchanged-or-reviewed; retention/ROPA impact noted in CHANGELOG; 72-hour SDAIA breach-notification runbook referenced; no prod data in repo/non-prod; secrets (`PII_ENCRYPTION_KEY`, `AUTH_SECRET`) never committed. **Omar = data-protection owner / break-glass holder.**

## F. Phased roadmap (full governance NOW; staging env deferred)

- **Adopt immediately:** §A Playbook + tiers/gates · §B Migrate adoption + baseline + atomic cutover + DIRECT_URL config fix · §C Vercel+Supabase pipeline + instant app rollback · §D `/api/health`+Sentry+logging+alerting · §E CI security gates + PDPL checklist + non-prod de-identification · §G doc reconciliation.
- **Sequenced (deferred):** **R1** staging env (separate Supabase project + Vercel staging target, prod-shaped de-identified data) · **R2** feature-flag infra (+ flag-tagged Sentry) · **R3** canary/blue-green (Vercel traffic split, after R1+R2) · **R4** automated DB-restore drills.
- **Interim substitute (until R1):** PII-sanitized disposable clone (§B.2), recreated on demand from latest prod backup per T2/T3 change.
- **Degraded while staging absent (explicit):** no persistent prod-shaped pre-prod env (rely on CI-full-path + Vercel PR preview + on-demand sanitized clone); no soak/canary (mitigated by expand/contract + instant Vercel rollback + tight Sentry release alerts); backfills validated on the disposable clone.

## G. Doc reconciliation & where this lives

- **AGENTS.md:** rewrite **§4** to the §B policy (delete the current pro-`db push` block ~lines 133–136 + the §3.9.1 db-push references ~116/120; replace with Migrate-of-record, dated, noting the v4.7.0 baseline cutover). Add **§3.10** (Playbook §A), **§8** (Observability §D), **§9** (Security/PDPL §E). Cross-link §3.4/§3.8/§3.9/§3.9.1/§7.1.
- **README.md:** lines 127/132/194 already state "Prisma Migrate, never `db push`, full migration history" — become **true** once the baseline lands; adjust line 127 wording ("baseline created once, then `migrate deploy`"). Badge already `4.7.0`.
- **CLAUDE.md (project root):** add a short "Release & DB Governance" pointer naming AGENTS §3.10/§4/§8/§9 as binding per-change SSOT; sync the §4 db-push→migrate correction.

## Critical files

- `packages/db/prisma.config.ts` — `datasource.url` → `DIRECT_URL`
- `packages/db/src/index.ts` — keep pooled `DATABASE_URL`; add comment
- `packages/db/package.json` — add `db:migrate:*` scripts
- `packages/db/prisma/migrations/0_init/migration.sql` — generated baseline (NEW; riskiest artifact)
- `.github/workflows/ci.yml` — `db push --accept-data-loss` → `migrate deploy`; add `DIRECT_URL`, `npm audit`, `gitleaks`, SBOM; gated post-CI migrate+deploy+health (recommend split `deploy.yml`)
- `apps/web/app/api/health/route.ts` — NEW
- `apps/web/sentry.{server,edge,client}.config.ts` — NEW
- `AGENTS.md` — rewrite §4; add §3.10/§8/§9
- `CLAUDE.md` (project root) — pointer + §4 sync
- `README.md` — line 127 wording

## Verification (end-to-end)

1. **Baseline rehearsal (disposable sanitized clone):** `migrate diff` clone-vs-schema **empty** → `migrate resolve --applied 0_init` → `migrate status` up-to-date → `migrate deploy` emits **zero DDL** → seeds + `payment-correctness-test.ts` pass → row counts unchanged.
2. **Prod baseline:** snapshot recorded → `migrate resolve --applied 0_init` (metadata only) → `migrate status` clean → `migrate diff` prod-vs-schema empty.
3. **Atomic cutover proof:** CI on the cutover PR runs `migrate deploy` (not `db push`), green on ephemeral PG; no mixed state.
4. **Sample change through the new pipeline:** trivial **T1** UI change → branch → §3.4/§3.8 verify → green full-path CI → merge → pipeline `migrate deploy` (no-op) → Vercel deploy → `/api/health` 200 → Sentry clean 10 min. Then a **T2 additive-column** change → expand path → `migrate dev` → reviewed SQL → CI `migrate deploy` ephemeral → merge → prod applies the one migration → post-deploy verified. Then **prove rollback:** ship a benign bad build → health gate fails → promote previous Vercel deployment (seconds; DB untouched because the migration was expand-only).

## Recommended defaults (change if preferred)

- Error tracking = **Sentry**; uptime = **Better Stack free / Sentry Crons**.
- Disposable clone = **temporary Supabase project** (no local Postgres on the dev machine).
- Break-glass / data-protection owner = **Omar** (sole holder of prod `DIRECT_URL`).
- CI vs deploy = **split `deploy.yml`** from `ci.yml`.

---

# 2. Engineering backlog (non-blocking — none gate the live product)

These are tracked debt/polish, each its own small scoped change. None is in progress.

1. **Extract pure money logic** into a shared non-`"use server"` module so the partial-payment CI test exercises the real code, not a mirror (current `e2e/seed/payment-correctness-test.ts` re-implements the algorithm; Server Actions can't run outside a Next runtime).
2. **RentPayment append-only ledger** — the long-term-correct payment model (R4 residual; deliberately deferred to bound v4.7.0 blast radius). Would retire the `effectivePaid` legacy-`coalesce` rule and enable per-payment reversals/refunds.
3. **Reports-page header i18n** — `REPORT_GROUPS` headers render English in the Arabic view (page-level `lang`-source quirk; the group config is correctly bilingual). Cosmetic; Arabic-first product so worth fixing.
4. **marketplace.ts cross-org `Customer.status` direct write** — bypasses the Deal-sync inside the atomic cross-org transfer transaction (v4.5.0 known follow-up).
5. **confirm-after-convert** can create a 2nd `WON` deal row (v4.5.0 known follow-up; customer status still resolves correctly via deterministic sync — low impact).
6. **Dev `axe` "2 issues" overlay** — investigate the `@axe-core/react` dev-mode accessibility findings observed during the v4.7.0 UI verification (dev-only; not a prod blocker but a11y matters per AGENTS §6.17).

Each, when picked up, runs through the §A Per-change Developer Playbook at its risk tier (most are T0/T1; #1 and #2 are T3 — money).
