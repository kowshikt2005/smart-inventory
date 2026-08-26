"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddRoleModal } from "@/components/roles/AddRoleModal";
import { EditRoleModal } from "@/components/roles/EditRoleModal";
import { Plus, MoreHorizontal, Pencil, Trash2, Shield, Loader2 } from "lucide-react";
import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import type { RolePermissions } from "@/types/permissions";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: RolePermissions;
  _count: { users: number };
}

export default function RolesPage() {
  const { data: session } = useSession();
  const { data: roles, isLoading, mutate } = useSWR<Role[]>("/api/roles", fetcher);
  const [showAdd, setShowAdd] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const canEdit = session?.user?.permissions?.masters_roles?.edit;

  const handleDelete = async (role: Role) => {
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    setDeleting(role.id);
    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete role");
        return;
      }
      mutate();
    } catch {
      alert("Failed to delete role");
    } finally {
      setDeleting(null);
    }
  };

  const formatRoleName = (name: string) =>
    name.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Roles</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage user roles and page-level permissions
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Role
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center w-[60px]">S.No.</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !roles?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No roles found
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role, rowIndex) => (
                  <TableRow key={role.id}>
                    <TableCell className="text-center text-muted-foreground">{rowIndex + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{formatRoleName(role.name)}</span>
                        {role.isSystem && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            System
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {role.description || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{role._count.users}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {role.isActive ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditRole(role)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {!role.isSystem && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(role)}
                                className="text-red-600"
                                disabled={deleting === role.id}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {deleting === role.id ? "Deleting..." : "Delete"}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          System roles cannot be deleted. Users must re-login after their role permissions change.
        </p>
      </div>

      <AddRoleModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={() => mutate()}
      />

      <EditRoleModal
        isOpen={!!editRole}
        role={editRole}
        onClose={() => setEditRole(null)}
        onSuccess={() => mutate()}
      />
    </DashboardLayout>
  );
}
