"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RolePermissionEditor } from "./RolePermissionEditor";
import { ALL_PERMISSION_KEYS, type RolePermissions } from "@/types/permissions";
import { Loader2, X } from "lucide-react";

interface RoleData {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: RolePermissions;
}

interface EditRoleModalProps {
  isOpen: boolean;
  role: RoleData | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditRoleModal({ isOpen, role, onClose, onSuccess }: EditRoleModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState<RolePermissions>({} as RolePermissions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isLockedAdmin = role?.isSystem && role?.name === "ADMIN";

  useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description || "");
      setIsActive(role.isActive);
      // Ensure all keys exist in permissions
      const perms: Record<string, { view: boolean; edit: boolean }> = {};
      for (const key of ALL_PERMISSION_KEYS) {
        const existing = (role.permissions as Record<string, { view: boolean; edit: boolean }>)?.[key];
        perms[key] = existing || { view: false, edit: false };
      }
      setPermissions(perms as RolePermissions);
    }
  }, [role]);

  if (!isOpen || !role) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Role name is required");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          permissions,
          isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update role");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-10">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            Edit Role: {role.name}
            {role.isSystem && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                System
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="editRoleName">Role Name *</Label>
              <Input
                id="editRoleName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={role.isSystem}
              />
            </div>
            <div>
              <Label htmlFor="editRoleDesc">Description</Label>
              <Textarea
                id="editRoleDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={1}
              />
            </div>
          </div>

          {!isLockedAdmin && (
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Active</Label>
              {!isActive && (
                <span className="text-xs text-muted-foreground">
                  Inactive roles cannot be assigned to new users
                </span>
              )}
            </div>
          )}

          <div>
            <Label className="mb-3 block">Permissions</Label>
            <RolePermissionEditor
              permissions={permissions}
              onChange={setPermissions}
              locked={isLockedAdmin}
            />
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
