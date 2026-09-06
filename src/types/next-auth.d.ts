import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isVerified: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    isVerified?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isVerified?: boolean;
  }
}
