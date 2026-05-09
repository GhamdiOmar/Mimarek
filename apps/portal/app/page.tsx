import { redirect } from "next/navigation";

export default function PortalRedirectPage() {
  const webUrl = process.env.NEXT_PUBLIC_WEB_APP_URL ?? "http://localhost:3000";
  redirect(`${webUrl.replace(/\/$/, "")}/auth/login?mode=tenant`);
}
