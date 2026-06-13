# Mimaric — Consolidated Remaining Work

**Created:** 2026-06-13 (post-v4.18.0 release) · **Owner:** Omar Alghamdi
**Status of baseline:** v4.18.0 is **shipped** (PR #23 merged `74af715`, tag + GitHub release live, CI green). This file is the single backlog of everything still open — it folds in `future-plans/v4.18.0-followups.md` and the standing deferred items from the v4.18.0 plan, the architecture doc, and the v4.16 handover.

Sections are ordered by urgency: **(0)** must-do prod ops from the v4.18.0 release → **(1)** v4.18.0 follow-ups → **(2)** repo housekeeping → **(3)** near-term backlog → **(4) LATER IMPLEMENTATION** (explicitly parked) → **(5)** open product question.

---

## 0. v4.18.0 post-release prod ops — SUPERVISED, NOT YET RUN

These deploy the v4.18.0 schema + data fixes to **production** and must be run by Omar with eyes on the output. They were NOT run from the dev session because `.env.local` points at the **Sydney prod DB** (`aws-1-ap-southeast-2.pooler.supabase.com`) and **does not contain `PII_ENCRYPTION_KEY`** (only `PII_HASH_PEPPER`). Both data scripts fail closed without the key, and `rehash` would corrupt every `phoneHash` if run with a mismatched key — so run them in the real ops env with the correct key.

Run in order, recording before/after counts:

```bash
# 1. Additive index diff (composite [organizationId,*Hash] indexes + drop dead nationalId index).
#    Run PLAIN first — it self-aborts on any destructive diff and names blockers (AGENTS.md §4).
cd packages/db && npx prisma db push

# 2. Encrypt/repair marketplace customer phones written as plaintext / "—" pre-v4.18.0.
PII_ENCRYPTION_KEY=… PII_HASH_PEPPER=… DATABASE_URL=… npx tsx packages/db/scripts/repair-marketplace-customer-pii.ts

# 3. Re-hash ALL customer phones to the normalized HMAC blind index (so 0551234567 == +966551234567).
PII_ENCRYPTION_KEY=… PII_HASH_PEPPER=… DATABASE_URL=… npx tsx packages/db/scripts/rehash-customer-phones.ts
```

No RLS SQL needed (no new tables — `rls:check` confirms). After these, marketplace customers are searchable and all phone hashes are format-agnostic.

---

## 1. v4.18.0 follow-ups (tracked debts from the release)

### 1.1 Stabilize the marketplace cross-org E2E (`test.fixme`)
`apps/web/e2e/marketplace.cross-org.spec.ts` (`publish → browse → inquire → convert → settlement gate`) was **silently skipped since it was written** (matched no Playwright project). P4-1 added the `marketplace-tests` project + `check-e2e-coverage.mjs` guard, which surfaced it. It now:
- ✅ **Passes the P1-1 inquiry step** — marketplace PII encryption + the required-phone change work end-to-end.
- ❌ **Hangs in the seller's convert → settlement flow**: `clickVisible(/تحويل لصفقة|Convert to Deal/)` never resolves, even though the button label matches the real UI exactly (`my-listings/page.tsx:483`). The incoming-inquiry `DataTable` "Convert to Deal" button doesn't surface in the test's context within budget — a loading/rendering timing issue in pre-existing (v4.18.0-untouched) my-listings UI.

**Fix:** run the two-org flow interactively (seller publishes, buyer inquires with a valid phone, seller opens `/dashboard/marketplace/my-listings`); watch when the inquiry row + its button render. Replace the fixed `waitForTimeout` with `await expect(seller.getByText(/Convert to Deal/)).toBeVisible()` (or scroll the inquiries section into view), then remove `test.fixme`. The project already grants a 180s budget. `marketplace.mylistings-link.spec.ts` in the same project passes.

### 1.2 Native review of 5 inferred Arabic marketplace-status strings
`apps/web/lib/domain-labels.ts` — the admin/marketplace page was English-only before F5, so these were inferred (AGENTS.md §6.11.4 requires native review):
`UNDER_CONTRACT → تحت العقد` · `SOLD_TRANSFERRED → مُنقَّل` · `UNPUBLISHED → غير منشور` · `REJECTED → مرفوض` · `SUSPENDED → موقوف`.

### 1.3 Two pre-existing server logs seen during the marketplace CI run (not v4.18.0 regressions)
- `[WebServer] unexpected export *` — a Next.js module-shape log; no literal `export *` exists in `apps/web/app` or `apps/web/lib` (grep-confirmed). Likely a barrel/dependency module; confirm it isn't a malformed server-action surface.
- `Error: Your organization already has an active subscription` — incidental log during the Playwright run (the marketplace test creates only a unit fixture; the billing seed / another spec emits it). Confirm harmless or make the emitter idempotent.
- `User has no organization` (+ its 500) on shared dashboard pages for the org-less SYSTEM user — pre-existing (`getTenantSessionOrThrow` in a shared org-name action). Listed again in §3.

---

## 2. Repo housekeeping (working-tree WIP, not yet committed)

The working tree carries 44 uncommitted items from parallel work. Triage:

- **Promote to the repo** (clean planning docs / templates): `future-plans/architecture-required-fixes-2026-06-12.md` (the F4/F5 source the release references — currently untracked despite being cited in CHANGELOG/AGENTS.md), `future-plans/performance-and-load.md`, `future-plans/v4.16-handover.md`, `FUTURE_PLANS.md`, `env.example`, and the `docs/` + `user-guides/` deliverables if intended for the repo.
- **Decide deliberately**: `packages/db/prisma/migrations/` — **contradicts AGENTS.md §4** ("this repo has NO migration history; uses `db push`"). Either delete it or, if migrating to `prisma migrate`, do the full CI conversion in the same change (AGENTS.md §4). `CI-CD-Pipeline-Proposal/` is marked "do not touch — a study" (AGENTS.md §"Do NOT touch"); keep ignored or commit as a clearly-labeled study.
- **Do NOT commit — sensitive/junk**: `Individual data Absher.json` (likely real Saudi identity PII — keep out of git; add to `.gitignore`). The 8 `…:Zone.Identifier` files + the stray files literally named `git` and `gitignore` are Windows download/ADS artifacts — delete them.
- The committed planning doc `future-plans/v4.11-followups.md` (modified) and the deleted `future-plans/crm-kanban-card-enrichment.md` are your pre-existing edits — commit or revert per intent.

---

## 3. Near-term backlog (standing deferrals — opportunistic)

From the v4.18.0 plan's "Out of scope", the architecture doc, and the v4.16 handover:

- **True HTTP-403 middleware.** v4.16.1 shipped a defined Access-Denied *page* but it returns **HTTP 200**, not 403 (streaming SSR commits status before the denial renders). Next's experimental `forbidden()`/`authInterrupts` was tried and rejected (crashed on client hydration). A real 403 needs an edge-runtime middleware permission map — and the **F4 `lib/route-guards.ts` seam built in v4.18.0 is exactly what it needs.** Also open: the pre-existing `"User has no organization"` throw in `auth-helpers.ts`.
- **A5 registration verification layer** (deferred from v4.18.0; rate-limiting shipped, verification did not): email verification before activation + `PENDING_VERIFICATION` org quarantine + auto-expiry of unverified orgs (7–14d cron) + optional Cloudflare Turnstile (PDPL-friendlier than reCAPTCHA — no tracking cookies). Refs: OWASP Authentication + Email-Verification cheat sheets; Auth0 `email_verified` gating; GitLab unconfirmed-user auto-delete. Schema change → §4 RLS contract applies.
- **Ciphertext envelope + DB CHECK constraint** — versioned prefix on encrypted values + a `CHECK` validating it (the only layer that would have caught the P1-1 plaintext leak at write time). Requires a format migration of all encrypted columns; revisit with the next PII schema work.
- **F8 RSC conversions** — contracts / reservations / payments pages from `"use client"` to Server Components (continues the v4.16 dashboard migration). Opportunistic, one route at a time, never big-bang.
- **`/dashboard/more` decommission** — still live-wired (`auth.config.ts` system allowlist via the `shared` audience, `MobileUserMenuSheet`, `DashboardClientLayout`, a `more/profile` child). Careful unwiring, not a delete.
- **axe baseline closeout** — the CI gate still excludes two documented rules in `KNOWN_BASELINE_RULES` (`e2e/accessibility.admin.spec.ts`): `color-contrast` (success badge 4.28:1 — a `--success` token decision) and `aria-allowed-attr` (a Radix `asChild` `<span>` with `aria-expanded`). Fix, then remove the exclusions.
- **Full `t()` migration** of the remaining ~2,000 inline `lang === "ar"` ternaries — opportunistic (touched files only). F5 already centralized the densest cluster (domain labels).
- **`"use cache"` / `cacheComponents` migration** — keep `unstable_cache` for now (`getPublicPlans` cache key/tag are stable for the eventual switch).
- **Policy-based RLS** — research flagged it as an architecture change incompatible with the owner-role Prisma connection; not a patch. Current RLS-on-no-policy firewall stays.
- **Lint-warning burn-down** — ~484 warnings (only-warn keeps CI at 0 errors). Ratchet specific rules to error as files are cleaned.
- **Audit medium items not taken** — marketplace cursor pagination + counts; document lifecycle (remote deletion + audit); per-tenant blind-index keys (cross-tenant correlation hardening — current per-app pepper is acceptable at this scale).

---

## 4. LATER IMPLEMENTATION (explicitly parked — do not schedule yet)

### 4.1 DB region migration: Sydney → Bahrain (`me-south-1`)
The dominant felt-latency lever (~223ms → ~15ms per round-trip). RSC (v4.16) fixed the code side; **geography now dominates**. This is an ops/runbook task (data move + downtime window), not a code change. Detail in `future-plans/performance-and-load.md` §1 and the v4.16 handover. **Parked by Omar — revisit later.**

### 4.2 ZATCA e-invoicing module
Blocked on the ZATCA e-invoicing clearance pipeline (integration + compliance certification). Detail in `future-plans/v4.11-followups.md` §1. **Parked by Omar — revisit later.**

---

## 5. Open product question (gates the marketplace compliance items)

**Marketplace positioning: inquiry-only vs reserve-and-buy.** This decides whether the audit's marketplace compliance / license-verification workflow items are P0 or P2. It is a product call for Omar and is a prerequisite for scoping marketplace legal/compliance work. Until decided, those compliance items stay out of scope.

---

*This file consolidates and supersedes `future-plans/v4.18.0-followups.md`. When an item ships, strike it here and note the version.*
