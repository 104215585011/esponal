import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const hasGoogleProvider = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

const adapter = hasDatabaseUrl ? PrismaAdapter(prisma) : undefined;
const providers = hasGoogleProvider
  ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
      })
    ]
  : [];

export const authOptions: NextAuthOptions = {
  ...(adapter ? { adapter } : {}),
  providers,
  session: {
    strategy: adapter ? "database" : "jwt"
  },
  pages: {
    signIn: "/auth/sign-in"
  }
};
