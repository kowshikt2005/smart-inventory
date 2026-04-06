"use client";

import { getPermissionSections, type PermissionKey, type RolePermissions, type PagePermission, PERMISSION_PAGES } from "@/types/permissions";
import { Switch } from "@/components/ui/switch";
import { Lock } from "lucide-react";

interface RolePermissionEditorProps {
  permissions: RolePermissions;
  onChange: (permissions: RolePermissions) => void;
  locked?: boolean; // For ADMIN system role — all toggles forced on
}

export function RolePermissionEditor({ permissions, onChange, locked = false }: RolePermissionEditorProps) {
  const sections = getPermissionSections();

  const updatePermission = (key: PermissionKey, field: keyof PagePermission, value: boolean) => {
    if (locked) return;
    const current = permissions[key] || { view: false, edit: false };
    const updated = { ...current, [field]: value };
    // edit implies view
    if (field === "edit" && value) updated.view = true;
    // removing view removes edit
    if (field === "view" && !value) updated.edit = false;
    onChange({ ...permissions, [key]: updated });
  };

  const toggleSectionView = (keys: PermissionKey[], allOn: boolean) => {
    if (locked) return;
    const next = { ...permissions };
    for (const key of keys) {
      next[key] = { ...next[key], view: !allOn };
      if (allOn) next[key].edit = false; // turning off view turns off edit
    }
    onChange(next);
  };

  const toggleSectionEdit = (keys: PermissionKey[], allOn: boolean) => {
    if (locked) return;
    const next = { ...permissions };
    for (const key of keys) {
      next[key] = { ...next[key], edit: !allOn };
      if (!allOn) next[key].view = true; // turning on edit turns on view
    }
    onChange(next);
  };

  return (
    <div className="space-y-6">
      {locked && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <Lock className="h-4 w-4" />
          Admin role permissions cannot be modified
        </div>
      )}

      {sections.map(({ section, keys }) => {
        const allView = keys.every((k) => permissions[k]?.view);
        const allEdit = keys.every((k) => permissions[k]?.edit);

        return (
          <div key={section} className="border rounded-lg overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b">
              <h4 className="font-medium text-sm">{section}</h4>
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span>All View</span>
                  <Switch
                    checked={allView}
                    onCheckedChange={() => toggleSectionView(keys, allView)}
                    disabled={locked}
                    className="scale-75"
                  />
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span>All Edit</span>
                  <Switch
                    checked={allEdit}
                    onCheckedChange={() => toggleSectionEdit(keys, allEdit)}
                    disabled={locked}
                    className="scale-75"
                  />
                </label>
              </div>
            </div>

            {/* Permission rows */}
            <div className="divide-y">
              {keys.map((key) => {
                const perm = permissions[key] || { view: false, edit: false };
                const label = PERMISSION_PAGES[key].label;
                return (
                  <div key={key} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm">{label}</span>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <span>View</span>
                        <Switch
                          checked={perm.view}
                          onCheckedChange={(v) => updatePermission(key, "view", v)}
                          disabled={locked}
                          className="scale-75"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <span>Edit</span>
                        <Switch
                          checked={perm.edit}
                          onCheckedChange={(v) => updatePermission(key, "edit", v)}
                          disabled={locked || !perm.view}
                          className="scale-75"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
