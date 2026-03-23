import NextAuth, { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth-utils";
import { verifyOTP } from "@/lib/otp";
import { fillMissingPermissions, ALL_PERMISSION_KEYS, type RolePermissions } from "@/types/permissions";

/**
 * Load role data (id, name, permissions) for a user record.
 * Handles both migration states: roleId set or falling back to role enum.
 */
/** Build full permissions object with all keys set to view+edit true */
function buildAdminPermissions(): RolePermissions {
  const perms = {} as RolePermissions;
  for (const key of ALL_PERMISSION_KEYS) {
    perms[key] = { view: true, edit: true };
  }
  return perms;
}

async function loadUserRole(user: { roleId?: string | null; role?: string }) {
  // Primary: use roleId FK
  if (user.roleId) {
    const role = await db.role.findUnique({
      where: { id: user.roleId },
      select: { id: true, name: true, permissions: true },
    });
    if (role) {
      return {
        roleId: role.id,
        roleName: role.name,
        // ADMIN always gets all permissions regardless of DB state
        permissions: role.name === 'ADMIN'
          ? buildAdminPermissions()
          : fillMissingPermissions(role.permissions as unknown as Partial<RolePermissions>),
      };
    }
  }

  // Fallback: look up Role by enum name (during migration)
  if (user.role) {
    const role = await db.role.findUnique({
      where: { name: user.role },
      select: { id: true, name: true, permissions: true },
    });
    if (role) {
      return {
        roleId: role.id,
        roleName: role.name,
        permissions: role.name === 'ADMIN'
          ? buildAdminPermissions()
          : fillMissingPermissions(role.permissions as unknown as Partial<RolePermissions>),
      };
    }
  }

  // Default: empty permissions (shouldn't happen in normal flow)
  return {
    roleId: '',
    roleName: user.role || 'SALESMAN',
    permissions: {} as RolePermissions,
  };
}

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

          const roleData = await loadUserRole(user);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: roleData.roleName,
            roleId: roleData.roleId,
            roleName: roleData.roleName,
            permissions: roleData.permissions,
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

          const roleData = await loadUserRole(user);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: roleData.roleName,
            roleId: roleData.roleId,
            roleName: roleData.roleName,
            permissions: roleData.permissions,
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
          let existingUser = await db.user.findUnique({
            where: { googleId: account.providerAccountId },
          });

          if (!existingUser) {
            existingUser = await db.user.findUnique({
              where: { email: user.email! },
            });

            if (existingUser) {
              await db.user.update({
                where: { id: existingUser.id },
                data: { googleId: account.providerAccountId },
              });
            } else {
              return false;
            }
          }

          if (!existingUser?.isActive) {
            return false;
          }

          const roleData = await loadUserRole(existingUser);

          user.id = existingUser.id;
          user.role = roleData.roleName;
          user.roleId = roleData.roleId;
          user.roleName = roleData.roleName;
          user.permissions = roleData.permissions;

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
        token.id = user.id as string;
        token.role = user.role;
        token.roleId = user.roleId;
        token.roleName = user.roleName;
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.roleId = token.roleId;
        session.user.roleName = token.roleName;
        session.user.permissions = token.permissions;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    signOut: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

// For backward compatibility
export const authOptions = authConfig;
