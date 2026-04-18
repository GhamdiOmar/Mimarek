import { requireSystem } from "../../../lib/auth-helpers";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSystem();
  return <>{children}</>;
}
