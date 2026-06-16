import { getSeoConfigPublic } from "../../actions/seo-config";
import LoginClient from "./LoginClient";

export default async function LoginPage() {
  const config = await getSeoConfigPublic();
  return <LoginClient falLicense={config?.regaPlatformFalLicense} />;
}
