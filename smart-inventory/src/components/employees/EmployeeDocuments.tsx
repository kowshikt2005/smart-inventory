"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, Image as ImageIcon, Upload, Trash2, Download, Loader2 } from "lucide-react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Document {
  id: string;
  label: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

interface EmployeeDocumentsProps {
  employeeId: string;
  canEdit: boolean;
}

const SUGGESTED_LABELS = [
  "Aadhar Card",
  "PAN Card",
  "Resume",
  "ID Proof",
  "Address Proof",
  "Appointment Letter",
  "Photo",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type }: { type: string }) {
  if (type === "application/pdf") {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  return <ImageIcon className="h-5 w-5 text-blue-500" />;
}

export function EmployeeDocuments({ employeeId, canEdit }: EmployeeDocumentsProps) {
  const { data: documents, mutate, isLoading } = useSWR<Document[]>(
    `/api/employees/${employeeId}/documents`,
    fetcher
  );
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file || !label.trim()) {
      setError("Both file and label are required");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", label.trim());

      const res = await fetch(`/api/employees/${employeeId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Upload failed");
        return;
      }

      setFile(null);
      setLabel("");
      mutate();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Delete this document?")) return;
    setDeleting(docId);

    try {
      const res = await fetch(`/api/employees/${employeeId}/documents/${docId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Delete failed");
        return;
      }

      mutate();
    } catch {
      alert("Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Documents</h3>

      {/* Upload form */}
      {canEdit && (
        <div className="border border-dashed border-gray-300 rounded-lg p-4 mb-4">
          {error && (
            <div className="text-sm text-red-600 mb-2">{error}</div>
          )}

          <div className="flex gap-3 items-end mb-3">
            <div className="flex-1">
              <Label htmlFor="docLabel" className="text-xs">Label</Label>
              <Input
                id="docLabel"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Aadhar Card"
                className="h-9"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="docFile" className="text-xs">File (PDF, Image)</Label>
              <Input
                id="docFile"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="h-9"
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleUpload}
              disabled={uploading || !file || !label.trim()}
              className="h-9"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Upload
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_LABELS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setLabel(s)}
                className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Document list */}
      {isLoading ? (
        <div className="text-center py-4">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : !documents?.length ? (
        <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileIcon type={doc.fileType} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.label}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    <Badge variant="outline" className="text-[10px] px-1">
                      {doc.fileType.split("/")[1]?.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deleting === doc.id}
                  >
                    {deleting === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
