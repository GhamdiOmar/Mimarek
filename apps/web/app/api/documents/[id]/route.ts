import { NextResponse } from "next/server";
import { db } from "@repo/db";
import { UTApi } from "uploadthing/server";
import { getSessionOrThrow } from "../../../../lib/auth-helpers";
import { hasPermission } from "../../../../lib/permissions";

/**
 * UploadThing serves files at `<origin>/f/<fileKey>`. Extract the last path
 * segment of the stored URL to get the key (same helper as documents.ts).
 */
function fileKeyFromUrl(raw: string): string | null {
  try {
    const segments = new URL(raw).pathname.split("/").filter(Boolean);
    const key = segments[segments.length - 1];
    return key && key.length > 0 ? decodeURIComponent(key) : null;
  } catch {
    return null;
  }
}

/**
 * Authorized document download (SEC-006).
 *
 * Replaces direct UploadThing CDN links in the UI. The raw object URL was a
 * permanent bearer credential: anyone who obtained it (DOM scrape, logs, referrer,
 * chat) could fetch the file outside tenant/permission checks. This route instead
 * authorizes the request (session + `documents:read` + org-scope), then redirects
 * to a SHORT-LIVED signed URL minted offline via `UTApi.generateSignedURL` — so the
 * URL that ever leaves the server expires in minutes and is never rendered into the
 * page. The raw `url` is no longer returned by `getDocuments`.
 *
 * Full private-file closure (the underlying object also being private, not just the
 * access path) is one activation step away — see CHANGELOG [5.9.0] SEC-006: flip the
 * document routers to `acl:"private"`, enable per-request ACL override in the
 * UploadThing dashboard, and run the `updateACL` backfill. The signed-URL path here
 * already works for private objects, so no further code change is needed then.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await getSessionOrThrow();
  } catch {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  if (!session.organizationId || !hasPermission(session.role, "documents:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const doc = await db.document.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, url: true },
  });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const key = fileKeyFromUrl(doc.url);
  if (!key) {
    return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  }

  try {
    const { ufsUrl } = await new UTApi().generateSignedURL(key, { expiresIn: 60 * 15 });
    return NextResponse.redirect(ufsUrl);
  } catch (error) {
    console.error(`[documents] signed URL failed for ${id}:`, error);
    return NextResponse.json({ error: "File temporarily unavailable" }, { status: 502 });
  }
}
