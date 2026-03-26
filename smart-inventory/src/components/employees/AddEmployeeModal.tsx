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
import {
  X,
  Loader2,
  User,
  Upload,
  Plus,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SUGGESTED_LABELS = [
  "Aadhar Card",
  "PAN Card",
  "Resume",
  "ID Proof",
  "Address Proof",
  "Appointment Letter",
  "Experience Letter",
  "10th Certificate",
  "12th Certificate",
];

interface RoleOption {
  id: string;
  name: string;
}

interface PendingDocument {
  localId: string;
  file: File;
  label: string;
}

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddEmployeeModal({
  isOpen,
  onClose,
  onSuccess,
}: AddEmployeeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Documents state
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docLabel, setDocLabel] = useState("");
  const [docError, setDocError] = useState("");
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch roles dynamically
  const { data: roles } = useSWR<RoleOption[]>(
    isOpen ? "/api/roles?activeOnly=true" : null,
    fetcher
  );

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    roleId: "",
    phone: "",
    designation: "",
    department: "",
    salary: "",
    joinDate: new Date().toISOString().split("T")[0],
  });

  // Set default roleId when roles load
  useEffect(() => {
    if (roles?.length && !formData.roleId) {
      const salesman = roles.find((r) => r.name === "SALESMAN");
      setFormData((prev) => ({ ...prev, roleId: salesman?.id || roles[0].id }));
    }
  }, [roles, formData.roleId]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      const defaultRoleId =
        roles?.find((r) => r.name === "SALESMAN")?.id || roles?.[0]?.id || "";
      setFormData({
        name: "",
        email: "",
        password: "",
        roleId: defaultRoleId,
        phone: "",
        designation: "",
        department: "",
        salary: "",
        joinDate: new Date().toISOString().split("T")[0],
      });
      setError(null);
      setSubmitStep(null);
      setPhotoFile(null);
      setPhotoPreview(null);
      setPendingDocs([]);
      setDocFile(null);
      setDocLabel("");
      setDocError("");
    }
  }, [isOpen, roles]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Profile photo must be JPEG, PNG, or WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile photo must be under 5MB");
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleAddDocument = () => {
    if (!docFile || !docLabel.trim()) {
      setDocError("Both a label and a file are required");
      return;
    }
    setPendingDocs((prev) => [
      ...prev,
      { localId: crypto.randomUUID(), file: docFile, label: docLabel.trim() },
    ]);
    setDocFile(null);
    setDocLabel("");
    setDocError("");
    if (docFileInputRef.current) docFileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSubmitStep("Creating employee…");

    try {
      // Step 1: Create employee record
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          roleId: formData.roleId,
          phone: formData.phone || null,
          designation: formData.designation || null,
          department: formData.department || null,
          salary: formData.salary ? parseFloat(formData.salary) : null,
          joinDate: formData.joinDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create employee");

      const employeeId: string = data.id;

      // Step 2: Upload profile photo (non-fatal if it fails)
      if (photoFile) {
        setSubmitStep("Uploading profile photo…");
        const photoForm = new FormData();
        photoForm.append("photo", photoFile);
        await fetch(`/api/employees/${employeeId}/photo`, {
          method: "POST",
          body: photoForm,
        });
      }

      // Step 3: Upload documents sequentially (non-fatal)
      for (let i = 0; i < pendingDocs.length; i++) {
        setSubmitStep(`Uploading document ${i + 1} of ${pendingDocs.length}…`);
        const docForm = new FormData();
        docForm.append("file", pendingDocs[i].file);
        docForm.append("label", pendingDocs[i].label);
        await fetch(`/api/employees/${employeeId}/documents`, {
          method: "POST",
          body: docForm,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
      setSubmitStep(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Escape key closes modal (disabled during submit)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, isSubmitting]);

  // Auto-focus first field
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Add New Employee</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {/* ── Profile Photo ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Profile Photo
            </h3>
            <div className="flex items-center gap-4">
              {/* Avatar preview */}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 hover:border-teal-400 transition-colors shrink-0"
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-gray-400" />
                )}
              </button>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {photoFile ? "Change Photo" : "Upload Photo"}
                  </Button>
                  {photoFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreview(null);
                        if (photoInputRef.current)
                          photoInputRef.current.value = "";
                      }}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  JPEG, PNG, or WebP — max 5 MB. Optional.
                </p>
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

          {/* ── Basic Information ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  ref={firstInputRef}
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="email">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="password">
                  Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Enter password"
                  minLength={6}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                />
              </div>
            </div>
          </div>

          {/* ── Role & Access ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Role & Access
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">
                  User Role <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.roleId}
                  onValueChange={(value) =>
                    handleSelectChange("roleId", value)
                  }
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name
                          .split("_")
                          .map(
                            (w: string) =>
                              w.charAt(0) + w.slice(1).toLowerCase()
                          )
                          .join(" ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="joinDate">
                  Join Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="joinDate"
                  type="date"
                  name="joinDate"
                  value={formData.joinDate}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* ── Job Details ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Job Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  type="text"
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  placeholder="e.g., Sales Executive"
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="e.g., Sales"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="salary">Monthly Salary (₹)</Label>
                <Input
                  id="salary"
                  type="number"
                  name="salary"
                  value={formData.salary}
                  onChange={handleChange}
                  placeholder="Enter monthly salary"
                  min="0"
                  step="1000"
                />
              </div>
            </div>
          </div>

          {/* ── Documents ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Documents{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </h3>

            <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3">
              {docError && (
                <p className="text-sm text-red-600">{docError}</p>
              )}

              {/* Add a document row */}
              <div className="flex gap-3 items-end">
                <div className="flex-1 min-w-0">
                  <Label htmlFor="docLabel" className="text-xs">
                    Document Name
                  </Label>
                  <Input
                    id="docLabel"
                    value={docLabel}
                    onChange={(e) => setDocLabel(e.target.value)}
                    placeholder="e.g., Aadhar Card"
                    className="h-9"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Label htmlFor="docFile" className="text-xs">
                    File (PDF or image)
                  </Label>
                  <Input
                    id="docFile"
                    ref={docFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) =>
                      setDocFile(e.target.files?.[0] || null)
                    }
                    className="h-9"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddDocument}
                  className="h-9 shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              {/* Quick-fill label chips */}
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_LABELS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDocLabel(s)}
                    className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Queued documents */}
              {pendingDocs.length > 0 && (
                <div className="space-y-2 pt-1">
                  {pendingDocs.map((doc) => (
                    <div
                      key={doc.localId}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {doc.file.type === "application/pdf" ? (
                          <FileText className="h-4 w-4 text-red-500 shrink-0" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">
                          {doc.label}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">
                          {doc.file.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingDocs((prev) =>
                            prev.filter((d) => d.localId !== doc.localId)
                          )
                        }
                        className="text-gray-400 hover:text-red-500 shrink-0 ml-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-teal-500 hover:bg-teal-600 text-white min-w-[140px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {submitStep || "Creating…"}
                </>
              ) : (
                "Create Employee"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
