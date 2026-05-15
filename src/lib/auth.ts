import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import bcrypt from "bcryptjs";
import type { Provider } from "next-auth/providers/index";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

export function getAuthOptions(): NextAuthOptions {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasGoogleProvider = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  const providers: Provider[] = hasGoogleProvider
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID ?? "",
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
        })
      ]
    : [];

  providers.push(
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password || !hasDatabaseUrl) {
          return null;
        }

        const { prisma } = require("@/lib/prisma") as typeof import("@/lib/prisma");
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() }
        });

        if (!user?.password) return null;

        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image
        };
      }
    })
  );

  const callbacks: NextAuthOptions["callbacks"] = {
    async jwt({ token, user }) {
      const tokenWithId = token as typeof token & { id?: string };

      if (user?.id) {
        tokenWithId.id = user.id;
      } else if (!tokenWithId.id && token.sub) {
        tokenWithId.id = token.sub;
      }

      return tokenWithId;
    },
    async session({ session, token }) {
      const tokenWithId = token as typeof token & { id?: string };

      if (session.user) {
        (session.user as { id?: string }).id = tokenWithId.id ?? token.sub;
      }

      return session;
    }
  };

  if (!hasDatabaseUrl) {
    return {
      providers,
      session: {
        strategy: "jwt"
      },
      callbacks,
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
      strategy: "jwt"
    },
    callbacks,
    pages: {
      signIn: "/auth/sign-in"
    }
  };
}
