import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";
import type { RolePermissions } from "@/types/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      roleId: string;
      roleName: string;
      permissions: RolePermissions;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    roleId: string;
    roleName: string;
    permissions: RolePermissions;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role: string;
    id: string;
    roleId: string;
    roleName: string;
    permissions: RolePermissions;
  }
}
