import { requireTenant } from "../../lib/auth-helpers";
import DashboardClientLayout from "./DashboardClientLayout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireTenant();
  return (
    <DashboardClientLayout session={session}>
      {children}
    </DashboardClientLayout>
  );
}
