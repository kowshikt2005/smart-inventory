import NextAuth, { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth-utils";
import { fillMissingPermissions, ALL_PERMISSION_KEYS, type RolePermissions } from "@/types/permissions";
import { cache } from "@/lib/cache";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_SECONDS = 300; // 5 minutes
const LOGIN_ATTEMPTS_PREFIX = "login_attempts:";

const MAX_IP_LOGIN_ATTEMPTS = 10;
const IP_LOCKOUT_SECONDS = 900; // 15 minutes
const IP_LOGIN_PREFIX = "ip_login_attempts:";

function getClientIP(request?: Request): string {
  if (!request) return "unknown";
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP;
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  return "unknown";
}

function checkLoginRateLimit(identifier: string): boolean {
  const key = `${LOGIN_ATTEMPTS_PREFIX}${identifier}`;
  const attempts = cache.get<number>(key) ?? 0;
  return attempts >= MAX_LOGIN_ATTEMPTS;
}

function checkIPRateLimit(ip: string): boolean {
  const key = `${IP_LOGIN_PREFIX}${ip}`;
  const attempts = cache.get<number>(key) ?? 0;
  return attempts >= MAX_IP_LOGIN_ATTEMPTS;
}

export function getLoginLockoutRemaining(identifier: string, ip?: string): number {
  let maxRemaining = 0;

  const idKey = `${LOGIN_ATTEMPTS_PREFIX}${identifier}`;
  const idAttempts = cache.get<number>(idKey) ?? 0;
  if (idAttempts >= MAX_LOGIN_ATTEMPTS) {
    const remaining = cache.getTTL(idKey);
    if (remaining > 0) maxRemaining = Math.max(maxRemaining, remaining);
  }

  if (ip) {
    const ipKey = `${IP_LOGIN_PREFIX}${ip}`;
    const ipAttempts = cache.get<number>(ipKey) ?? 0;
    if (ipAttempts >= MAX_IP_LOGIN_ATTEMPTS) {
      const remaining = cache.getTTL(ipKey);
      if (remaining > 0) maxRemaining = Math.max(maxRemaining, remaining);
    }
  }

  return maxRemaining;
}

function recordFailedLogin(identifier: string, ip?: string): void {
  const idKey = `${LOGIN_ATTEMPTS_PREFIX}${identifier}`;
  const idAttempts = (cache.get<number>(idKey) ?? 0) + 1;
  cache.set(idKey, idAttempts, LOGIN_LOCKOUT_SECONDS);

  if (ip) {
    const ipKey = `${IP_LOGIN_PREFIX}${ip}`;
    const ipAttempts = (cache.get<number>(ipKey) ?? 0) + 1;
    cache.set(ipKey, ipAttempts, IP_LOCKOUT_SECONDS);
  }
}

function clearLoginAttempts(identifier: string): void {
  cache.delete(`${LOGIN_ATTEMPTS_PREFIX}${identifier}`);
}

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

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;

export const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email or Phone", type: "text" },
        pin: { label: "PIN", type: "password" }
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.pin) {
          return null;
        }

        const identifier = (credentials.email as string).toLowerCase().trim();
        const isPhone = !identifier.includes("@");
        const rateLimitId = isPhone ? identifier.replace(/\D/g, "") : identifier;
        const ip = getClientIP(request);

        if (checkLoginRateLimit(rateLimitId) || checkIPRateLimit(ip)) {
          return null;
        }

        try {
          let user;
          if (isPhone) {
            const digits = rateLimitId;
            const last10 = digits.length > 10 ? digits.slice(-10) : digits;
            user = await db.user.findUnique({ where: { phone: `+91${last10}` } });
          } else {
            user = await db.user.findUnique({ where: { email: identifier } });
          }

          if (!user || !user.isActive) {
            recordFailedLogin(rateLimitId, ip);
            return null;
          }

          // Verify PIN: if user.pin is null, accept default PIN "123456"
          const enteredPin = (credentials.pin as string).replace(/\D/g, "");
          if (enteredPin.length !== 6) {
            recordFailedLogin(rateLimitId, ip);
            return null;
          }

          let isValidPin = false;
          if (!user.pin) {
            isValidPin = enteredPin === "123456";
          } else {
            isValidPin = await verifyPassword(enteredPin, user.pin);
          }

          if (!isValidPin) {
            recordFailedLogin(rateLimitId, ip);
            return null;
          }

          clearLoginAttempts(rateLimitId);

          const roleData = await loadUserRole(user);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: roleData.roleName,
            roleId: roleData.roleId,
            roleName: roleData.roleName,
            permissions: roleData.permissions,
            isDefaultPin: !user.pin,
          };
        } catch (error) {
          console.error("Auth error:", error);
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
        token.isDefaultPin = (user as unknown as Record<string, unknown>).isDefaultPin as boolean;
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
        session.user.isDefaultPin = token.isDefaultPin as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    signOut: "/login",
  },
  cookies: {
    sessionToken: {
      name: useSecureCookies
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,    // 8 hours — session expires after 8h of inactivity
    updateAge: 60 * 60,      // refresh cookie every 1h if user is active
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

// For backward compatibility
export const authOptions = authConfig;
