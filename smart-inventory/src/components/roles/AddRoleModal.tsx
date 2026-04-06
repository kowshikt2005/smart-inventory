"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RolePermissionEditor } from "./RolePermissionEditor";
import { ALL_PERMISSION_KEYS, type RolePermissions } from "@/types/permissions";
import { Loader2, X } from "lucide-react";

interface AddRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function emptyPermissions(): RolePermissions {
  const perms: Record<string, { view: boolean; edit: boolean }> = {};
  for (const key of ALL_PERMISSION_KEYS) {
    perms[key] = { view: false, edit: false };
  }
  // Dashboard view on by default
  perms.dashboard = { view: true, edit: false };
  return perms as RolePermissions;
}

export function AddRoleModal({ isOpen, onClose, onSuccess }: AddRoleModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<RolePermissions>(emptyPermissions());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Role name is required");
      return;
    }
    const hasAtLeastOneView = Object.values(permissions).some((p) => p.view === true);
    if (!hasAtLeastOneView) {
      setError("At least one view permission must be enabled.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), permissions }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create role");
        return;
      }

      setName("");
      setDescription("");
      setPermissions(emptyPermissions());
      onSuccess();
      onClose();
    } catch {
      setError("Failed to create role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-10">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Create New Role</h2>
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
              <Label htmlFor="roleName">Role Name *</Label>
              <Input
                id="roleName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Warehouse Staff"
              />
            </div>
            <div>
              <Label htmlFor="roleDesc">Description</Label>
              <Textarea
                id="roleDesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={1}
              />
            </div>
          </div>

          <div>
            <Label className="mb-3 block">Permissions</Label>
            <RolePermissionEditor permissions={permissions} onChange={setPermissions} />
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Role
          </Button>
        </div>
      </div>
    </div>
  );
}
