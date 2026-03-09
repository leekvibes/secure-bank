import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export function useSecureCookies(): boolean {
  const url = process.env.NEXTAUTH_URL ?? "";
  return url.startsWith("https://");
}

export function getSameSitePolicy(): "none" | "lax" {
  return useSecureCookies() ? "none" : "lax";
}

export function getSessionCookieName(): string {
  const cookiePrefix = useSecureCookies() ? "__Secure-" : "";
  return `${cookiePrefix}next-auth.session-token`;
}

export function getNextAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: getSameSitePolicy(),
    path: "/",
    secure: useSecureCookies(),
  };
}

const cookiePrefix = useSecureCookies() ? "__Secure-" : "";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: getSessionCookieName(),
      options: getNextAuthCookieOptions(),
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: getNextAuthCookieOptions(),
    },
    csrfToken: {
      name: useSecureCookies() ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: getNextAuthCookieOptions(),
    },
  },
  pages: {
    signIn: "/auth",
    error: "/auth",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!passwordMatch) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          agentSlug: user.agentSlug,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.agentSlug = (user as { agentSlug?: string }).agentSlug ?? "";
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.agentSlug = token.agentSlug as string;
      }
      return session;
    },
  },
};
