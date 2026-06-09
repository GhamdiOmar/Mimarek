# Future Plan — CRM Kanban Card Enrichment (owner avatar, card aging, time-in-stage)

**Logged:** 2026-06-09 · **Origin:** v4.11 CRM Kanban redesign (Phase 1). During the redesign I deferred three "premium kanban" signals (owner avatar, card aging, time-in-stage chip) and flagged them as a data gap. This file records the **verified** scope so it can be picked up cleanly later.

> **Correction (verified 2026-06-09, §3.8):** my first verbal note said owner/createdAt were "not exposed to the client." That was wrong. The CRM list loader already returns `agent` + the model already has `createdAt`/`updatedAt`. Only a *true* per-stage timestamp is genuinely missing. Accurate details below.

---

## What the v4.11 Kanban card currently shows
`apps/web/app/dashboard/crm/page.tsx` → `KanbanCard` (single view affordance, initials avatar from name, **deal-value prominence**, phone, source chip, hover call/WhatsApp/email). Column headers show count + **value subtotal**.

## The deferred signals (2026 premium-kanban best practice)
1. **Owner avatar** — show the assigned agent on each card.
2. **Card aging** — "N days old" (since created).
3. **Time-in-stage chip** — days in the *current* pipeline stage, threshold-colored (≤7 muted · 8–14 warning · >14 destructive). The highest-value flow signal.
4. *(N/A)* "Blocked" state — a generic-kanban idea; CRM leads have no "blocked" concept (stage = column). Skip unless a real blocked/on-hold status is added.

---

## Verified data availability

| Signal | Data status | Evidence | Blocked? |
|---|---|---|---|
| **Owner avatar** | `agent { id, name, email }` is already `include`d by the list loader and returned to the client | `apps/web/app/actions/customers.ts:286` (`getCustomers`); relation `agentId`/`agent` at `schema.prisma:231–232` | **No** — render only |
| **Card aging (since created)** | `createdAt` exists on the model and is returned | `schema.prisma:240` | **No** — render only |
| **True time-in-stage** | **No `stageEnteredAt` / status-change timestamp field.** `updatedAt` exists but is a *coarse proxy* — any edit bumps it, so it does NOT mean "entered this stage" | `schema.prisma:241` (`updatedAt`); no per-stage field in `model Customer` | **Yes** — needs new data |
| Stage history (alternative source) | `CustomerActivity[]` relation exists; could log/derive stage changes | `schema.prisma:237`; `getCustomerActivities` at `customers.ts:374` | Partial — only if status changes are recorded as activities |

---

## Remediation (tiered)

### Tier 1 — Quick win, NO schema change
- **Owner avatar:** in `KanbanCard`, render the agent's initials avatar (reuse the existing `initials` helper on `customer.agent?.name`); show name on hover/`title`. Data already present via `getCustomers`.
- **Card aging (optional):** show a muted "Nd" from `customer.createdAt`. Lower value than time-in-stage; include only if useful.
- Effort: ~½ day, UI-only, no migration.

### Tier 2 — Proper time-in-stage (schema + write-path)
Two options:
- **(A) Dedicated field (recommended):** add `stageEnteredAt DateTime? @default(now())` to `Customer`; set `stageEnteredAt = now()` inside `updateCustomerStatus` (`customers.ts:39`) whenever `status` changes; expose it from `getCustomers`; render a threshold-colored aging chip on the card.
  - **`db push` hazard (AGENTS.md §4):** new column on a populated prod table must carry `@default(...)` — `@default(now())` backfills existing rows safely. Confirm with a plain `prisma db push` against a prod-like DB before deploy.
- **(B) Derive from `CustomerActivity`:** if every status change is written as a `CustomerActivity`, compute time-in-stage from the latest stage-change activity. No schema change, but requires that the write-path reliably logs stage transitions (verify before relying on it).
- Effort: ~1 day incl. migration + write-path + UI; pick (A) unless activity logging is already authoritative.

---

## Acceptance criteria (when picked up)
- Kanban card shows owner initials avatar (Tier 1) and a threshold-colored time-in-stage chip (Tier 2), western digits, RTL-safe, both themes.
- `getCustomers` returns the needed fields (agent already; + `stageEnteredAt` if Tier 2-A).
- Verified in the running UI (light/dark × AR/EN) per §3.4 — **note:** `/dashboard/crm` is fine in dev, but `/dashboard/payments` OOM-crashes Turbopack dev; capture against a production build (`next build && next start`).
- No `db push` data-loss on the new column (prove the `@default(now())` backfill).

**Priority:** P2 enhancement (post-v4.11). Not a regression — the v4.11 card is a clear improvement already.
