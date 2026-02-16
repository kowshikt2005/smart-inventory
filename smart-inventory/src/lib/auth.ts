import NextAuth, { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth-utils";
import { verifyOTP } from "@/lib/otp";

export const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await db.user.findUnique({
            where: { email: credentials.email as string },
          });

          if (!user || !user.isActive) {
            return null;
          }

          const isValidPassword = await verifyPassword(credentials.password as string, user.password);
          if (!isValidPassword) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      }
    }),
    CredentialsProvider({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.otp) {
          return null;
        }

        try {
          const isValid = await verifyOTP(
            credentials.phone as string,
            credentials.otp as string
          );

          if (!isValid) {
            return null;
          }

          // Normalize phone for lookup
          let normalizedPhone = (credentials.phone as string).replace(/[\s-]/g, "");
          if (!normalizedPhone.startsWith("+")) {
            normalizedPhone = "+91" + normalizedPhone;
          }

          const user = await db.user.findUnique({
            where: { phone: normalizedPhone },
          });

          if (!user || !user.isActive) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          console.error("Phone OTP auth error:", error);
          return null;
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          // Check if user exists with this Google ID
          let existingUser = await db.user.findUnique({
            where: { googleId: account.providerAccountId },
          });

          if (!existingUser) {
            // Check if user exists with this email
            existingUser = await db.user.findUnique({
              where: { email: user.email! },
            });

            if (existingUser) {
              // Link Google account to existing user
              await db.user.update({
                where: { id: existingUser.id },
                data: { googleId: account.providerAccountId },
              });
            } else {
              // User doesn't exist - reject sign in
              // Admin must create the user first
              return false;
            }
          }

          if (!existingUser?.isActive) {
            return false;
          }

          // Update user object with database info
          user.id = existingUser.id;
          user.role = existingUser.role;

          return true;
        } catch (error) {
          console.error("Google sign in error:", error);
          return false;
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

// For backward compatibility
export const authOptions = authConfig;