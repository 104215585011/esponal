import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export function getAuthOptions(): NextAuthOptions {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasGoogleProvider = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  const providers = hasGoogleProvider
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID ?? "",
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
        })
      ]
    : [];

  if (!hasDatabaseUrl) {
    return {
      providers,
      session: {
        strategy: "jwt"
      },
      pages: {
        signIn: "/auth/sign-in"
      }
    };
  }

  const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma");

  return {
    adapter: PrismaAdapter(prisma),
    providers,
    session: {
      strategy: "database"
    },
    pages: {
      signIn: "/auth/sign-in"
    }
  };
}
