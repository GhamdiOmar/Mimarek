import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "../../auth";
import { LanguageProvider } from "../../components/LanguageProvider";
import { SimpleSessionProvider } from "../../components/SimpleSessionProvider";
import IdleTimeoutGuard from "../../components/session/IdleTimeoutGuard";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login?mode=tenant");
  if (session.user.role !== "USER") redirect("/dashboard");

  return (
    <SimpleSessionProvider session={session}>
      <LanguageProvider>
        <IdleTimeoutGuard />
        {children}
      </LanguageProvider>
    </SimpleSessionProvider>
  );
}
