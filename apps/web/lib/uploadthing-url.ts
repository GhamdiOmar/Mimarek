/**
 * Shared UploadThing URL helpers (SEC-006).
 *
 * Single home for the CDN-origin allowlist + fileKey extraction. Previously the
 * fileKey helper was copy-pasted in `app/actions/documents.ts` and
 * `app/api/documents/[id]/route.ts` (and would have been a third copy in the
 * portal download route) — so a fix to one could silently drift from the others.
 *
 * Plain, dependency-free module (NOT `"use server"`, NOT the client
 * `lib/uploadthing.ts` which pulls `@uploadthing/react`) so it is safe to import
 * from server actions AND route handlers without dragging client code along.
 */

// UploadThing CDN origins for this app (app ID: c5k2lwc5ws).
//   utfs.io  — legacy shared CDN (still serves files from v6-era and older uploads)
//   *.ufs.sh — new app-scoped CDN introduced in UploadThing v6+ (app-specific subdomain)
// Source: UPLOADTHING_APP_ID env var + UploadThing v7 SDK behavior confirmed via package.json
export const UPLOADTHING_ALLOWED_ORIGINS = new Set([
  "https://utfs.io",
  "https://c5k2lwc5ws.ufs.sh",
]);

/** True only for URLs served from a known UploadThing CDN host for this app. */
export function isAllowedUploadThingUrl(raw: string): boolean {
  try {
    const { origin } = new URL(raw);
    return UPLOADTHING_ALLOWED_ORIGINS.has(origin);
  } catch {
    return false;
  }
}

/**
 * UploadThing serves every file at `<origin>/f/<fileKey>`. `UTApi.deleteFiles`
 * and `UTApi.generateSignedURL` both take the fileKey (NOT the URL — v7 keyType
 * only accepts "fileKey" | "customId"), so we extract the last path segment of
 * the stored URL. Returns null for any non-UploadThing / malformed URL so callers
 * can skip the remote operation without throwing.
 */
export function uploadThingFileKeyFromUrl(raw: string): string | null {
  try {
    const segments = new URL(raw).pathname.split("/").filter(Boolean);
    const key = segments[segments.length - 1];
    return key && key.length > 0 ? decodeURIComponent(key) : null;
  } catch {
    return null;
  }
}
