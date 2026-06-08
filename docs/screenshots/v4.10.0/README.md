# v4.10.0 — UI uniformity verification screenshots

Captured 2026-06-08 against the local **production build** (`next start`, port 3000) via
`scripts/capture-v4.10.0.mjs` (Playwright). Real seed data, authenticated sessions
(`admin@mimaric.sa` tenant + `system@mimaric.sa` platform). Each shot validates the P1–P6
uniformity work in this release.

| File | Route | Theme · Lang · Device | Validates |
|---|---|---|---|
| 01 | reservations | dark · AR · desktop | Badges, icon-only row actions, pills, DataTable |
| 02 | reservations | light · EN · desktop | Same, LTR + light |
| 03 | payments | dark · AR · desktop | Status Badges, numeric align, rowClassName tone |
| 04 | payments | light · EN · desktop | Same, LTR + light |
| 05 | contracts | light · EN · desktop | Sign forward action (icon-only, primary tint) |
| 06 | contracts | dark · AR · desktop | Same, RTL + dark |
| 07 | units (table) | dark · AR · desktop | Bulk-select checkboxes, pills, DataTable |
| 08 | units (table) | light · EN · desktop | Same, LTR + light |
| 09 | settings/team | light · EN · desktop | Remove = icon-only destructive (P3 fix) |
| 10 | maintenance/tickets | dark · AR · desktop | DataTable, SLA row accents, icon actions |
| 11 | marketplace | light · EN · desktop | Browse/Inquiries pill tabs (aria-pressed) |
| 12 | settings/audit | dark · AR · desktop | Audit DataTable, action color badge |
| 13 | reservations | dark · AR · **mobile** | Tables → cards, mobile shell, badges |
| 14 | payments | light · EN · **mobile** | Tables → cards |
| 15 | admin/coupons | light · EN · desktop | Platform DataTable + access model (§8) |
| 16 | admin/coupons | dark · AR · desktop | Same, RTL + dark |
| 17 | admin/subscriptions | light · EN · desktop | Platform DataTable with data + status badges |
| 18 | admin/plans | dark · AR · desktop | Platform DataTable, isPublic status |

Re-generate: start the prod server (`npm run start --workspace=apps/web`) then `node scripts/capture-v4.10.0.mjs`.
