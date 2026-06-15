import type { ComponentProps } from "react";
import { requirePermission } from "../../../lib/auth-helpers";
import { getDocuments } from "../../actions/documents";
import DocumentsView from "./DocumentsView";

/**
 * Documents — Server Component (CX-003 pt1). Fetches the document list
 * server-side so the page arrives already filled (no client mount-fetch
 * waterfall). Permission matches `getDocuments` (`documents:read`). The
 * interactive client body (upload, filter, export) lives in DocumentsView.
 */
export default async function DocumentVaultPage() {
  await requirePermission("documents:read");
  const initialDocs = (await getDocuments()) as ComponentProps<
    typeof DocumentsView
  >["initialDocs"];

  return <DocumentsView initialDocs={initialDocs} />;
}
