import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "../../../../lib/cron-auth";

/**
 * ZATCA B2C reporting-sweep endpoint (D24) — SCAFFOLD ONLY for R2.
 *
 * Vercel Cron sends:  Authorization: Bearer $CRON_SECRET
 * Manual trigger:     GET /api/cron/zatca-report?secret=$CRON_SECRET
 *
 * R2 ships Track A only: real-time CLEARANCE of standard tax invoices via
 * `clearInvoiceNow` (apps/web/app/actions/zatca/clearance.ts). Simplified (B2C)
 * documents are REPORTED to ZATCA after-the-fact, not cleared in-line — that is
 * Track C and lands in R4.
 *
 * R4 — the REAL sweep this stub stands in for — will:
 *   1. Find TenantDocuments with zatcaStatus = PENDING that are simplified/B2C,
 *   2. POST each to the ZATCA reporting endpoint via the network client,
 *   3. Persist the outcome (REPORTED / REJECTED) + ZatcaClearanceLog rows.
 *
 * Until then this handler authenticates the cron caller and returns a no-op
 * result. It performs NO database reads or writes.
 */
function handle(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  return NextResponse.json({
    ok: true,
    swept: 0,
    note: "B2C reporting sweep lands with Track C (R4); Track A is real-time clearance.",
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
