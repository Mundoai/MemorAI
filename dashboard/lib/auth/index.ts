import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const providers = [];
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    })
  );
}
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: DrizzleAdapter(db),
  providers,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }
      // Fetch role from DB and store in JWT (runs on Node.js runtime during
      // sign-in and token refresh, NOT on Edge runtime like the session callback).
      if (token.id && (trigger === "signIn" || trigger === "signUp" || !token.role)) {
        try {
          const dbUser = await db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.id, token.id as string))
            .limit(1);
          token.role = dbUser[0]?.role ?? "user";
        } catch {
          token.role = "user";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        // Role is already stored in the JWT — no DB query needed here.
        // This callback runs on both Edge (middleware) and Node.js runtimes,
        // so it must avoid DB calls (postgres doesn't work on Edge).
        (session.user as { role?: string }).role = (token.role as string) ?? "user";
      }
      return session;
    },
    authorized({ auth: session }) {
      return !!session?.user;
    },
  },
});
