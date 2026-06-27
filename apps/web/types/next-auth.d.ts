import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      organizationId: string | null;
      tokenVersion?: number;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    organizationId?: string | null;
    tokenVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    organizationId?: string | null;
    tokenVersion?: number;
  }
}
