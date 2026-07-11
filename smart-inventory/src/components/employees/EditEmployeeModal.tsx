"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Loader2, User, Upload } from "lucide-react";
import useSWR from "swr";
import { EmployeeDocuments } from "./EmployeeDocuments";
import { useSession } from "next-auth/react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface RoleOption {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  department?: string;
  salary?: number;
  joinDate: string;
  photoUrl?: string;
  role?: string;
  roleId?: string;
  roleName?: string;
  isActive: boolean;
}

interface EditEmployeeModalProps {
  isOpen: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditEmployeeModal({
  isOpen,
  employee,
  onClose,
  onSuccess,
}: EditEmployeeModalProps) {
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const canEditDocs = session?.user?.permissions?.masters_employees?.edit === true;

  // Photo state
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Fetch roles dynamically
  const { data: roles } = useSWR<RoleOption[]>(
    isOpen ? "/api/roles?activeOnly=true" : null,
    fetcher
  );

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    pin: "",
    roleId: "",
    phone: "",
    designation: "",
    department: "",
    salary: "",
    joinDate: "",
    isActive: true,
  });

  // Populate form when employee changes
  useEffect(() => {
    if (employee && isOpen) {
      // Determine roleId: use employee.roleId if available, otherwise find by role name
      let roleId = employee.roleId || "";
      if (!roleId && roles?.length) {
        const match = roles.find(
          (r) => r.name === employee.role || r.name === employee.roleName
        );
        roleId = match?.id || "";
      }

      setFormData({
        name: employee.name || "",
        email: employee.email || "",
        pin: "",
        roleId,
        phone: employee.phone || "",
        designation: employee.designation || "",
        department: employee.department || "",
        salary: employee.salary ? String(employee.salary) : "",
        joinDate: employee.joinDate ? employee.joinDate.split("T")[0] : "",
        isActive: employee.isActive,
      });
      setCurrentPhotoUrl(employee.photoUrl || null);
      setPhotoPreview(null);
      setError(null);
    }
  }, [employee, isOpen, roles]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Photo must be JPEG, PNG, or WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be under 5MB");
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload immediately
    setPhotoUploading(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch(`/api/employees/${employee.id}/photo`, {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentPhotoUrl(updated.photoUrl);
        setPhotoPreview(null); // now served from server
        onSuccess?.(); // refresh list
      } else {
        setError("Failed to upload photo");
        setPhotoPreview(null);
      }
    } catch {
      setError("Failed to upload photo");
      setPhotoPreview(null);
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const updateData: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        roleId: formData.roleId,
        phone: formData.phone || null,
        designation: formData.designation || null,
        department: formData.department || null,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        joinDate: formData.joinDate,
        isActive: formData.isActive,
      };

      const pinDigits = formData.pin.replace(/\D/g, "");
      if (formData.pin.trim()) {
        if (pinDigits.length !== 6) {
          setError("PIN must be exactly 6 digits");
          setIsSubmitting(false);
          return;
        }
        updateData.pin = pinDigits;
      }

      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update employee");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Edit Employee</h2>
            <p className="text-sm text-gray-600">{employee.employeeNumber}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* ── Profile Photo ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Profile Photo</h3>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
                {photoPreview || currentPhotoUrl ? (
                  <img
                    src={photoPreview || currentPhotoUrl!}
                    alt={employee.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-gray-400" />
                )}
              </div>
              <div className="space-y-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                >
                  {photoUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {photoUploading ? "Uploading…" : currentPhotoUrl ? "Change Photo" : "Upload Photo"}
                </Button>
                <p className="text-xs text-gray-500">JPEG, PNG, or WebP — max 5 MB</p>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
          </div>

          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                <Input id="name" ref={firstInputRef} type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="Enter full name" />
              </div>
              <div>
                <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                <Input id="email" type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="Enter email address" />
              </div>
              <div>
                <Label htmlFor="pin">New PIN</Label>
                <Input id="pin" type="password" name="pin" value={formData.pin} onChange={handleChange} placeholder="Leave blank to keep current" maxLength={6} inputMode="numeric" pattern="[0-9]*" />
                <p className="text-xs text-gray-500 mt-1">Leave blank to keep current PIN. Enter 6 digits to change.</p>
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Enter phone number" />
              </div>
            </div>
          </div>

          {/* Role & Access */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Role & Access</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">User Role <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.roleId}
                  onValueChange={(value) => handleSelectChange("roleId", value)}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name.split("_").map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="joinDate">Join Date <span className="text-red-500">*</span></Label>
                <Input id="joinDate" type="date" name="joinDate" value={formData.joinDate} onChange={handleChange} required />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center space-x-2">
                  <Switch id="isActive" checked={formData.isActive} onCheckedChange={(checked) => handleSwitchChange("isActive", checked)} />
                  <Label htmlFor="isActive">Active Employee</Label>
                </div>
                <p className="text-xs text-gray-500 mt-1">Inactive employees cannot log in to the system</p>
              </div>
            </div>
          </div>

          {/* Job Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Job Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="designation">Designation</Label>
                <Input id="designation" type="text" name="designation" value={formData.designation} onChange={handleChange} placeholder="e.g., Sales Executive" />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input id="department" type="text" name="department" value={formData.department} onChange={handleChange} placeholder="e.g., Sales" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="salary">Monthly Salary</Label>
                <Input id="salary" type="number" name="salary" value={formData.salary} onChange={handleChange} placeholder="Enter monthly salary" min="0" step="1000" />
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="border-t border-gray-200 pt-6">
            <EmployeeDocuments employeeId={employee.id} canEdit={canEditDocs} />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-teal-500 hover:bg-teal-600 text-white">
              {isSubmitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Updating...</>) : "Update Employee"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
