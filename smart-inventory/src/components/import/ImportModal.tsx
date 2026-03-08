"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Upload,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Save,
  Trash2,
  FileSpreadsheet,
} from "lucide-react";
import {
  ENTITY_FIELDS,
  autoMatchColumns,
  type EntityType,
  type ImportField,
} from "@/lib/import-utils";
import * as XLSX from "xlsx";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entityType: EntityType;
  entityLabel: string;
}

interface SavedMapping {
  id: string;
  name: string;
  mapping: Record<string, string>;
}

interface RowValidation {
  rowIndex: number;
  status: "valid" | "error" | "warning";
  errors: { field: string; message: string }[];
  warnings: { field: string; message: string }[];
  resolvedData: Record<string, unknown>;
}

const STEPS = ["Upload", "Map Columns", "Preview", "Results"];

export function ImportModal({
  isOpen,
  onClose,
  onSuccess,
  entityType,
  entityLabel,
}: ImportModalProps) {
  const [step, setStep] = useState(0);

  // Step 1: Upload
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Step 2: Mapping
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  // Step 3: Validate
  const [validationResults, setValidationResults] = useState<RowValidation[]>([]);
  const [validating, setValidating] = useState(false);

  // Step 4: Import
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: { row: number; field: string; message: string }[];
  } | null>(null);
  const [importing, setImporting] = useState(false);

  const fields: ImportField[] = ENTITY_FIELDS[entityType] || [];

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setFileName("");
      setHeaders([]);
      setRawRows([]);
      setMapping({});
      setSelectedMappingId("");
      setSaveName("");
      setValidationResults([]);
      setImportResult(null);
      fetchSavedMappings();
    }
  }, [isOpen, entityType]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const fetchSavedMappings = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/import/mappings?entityType=${entityType}`
      );
      if (res.ok) {
        const data = await res.json();
        setSavedMappings(data.mappings || []);
      }
    } catch {
      // ignore
    }
  }, [entityType]);

  // ── File parsing ───────────────────────────────────────

  function processFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        });

        if (json.length === 0) {
          alert("File is empty or has no data rows.");
          return;
        }

        const hdrs = Object.keys(json[0]);
        setFileName(file.name);
        setHeaders(hdrs);
        setRawRows(json);

        // Auto-match columns
        const auto = autoMatchColumns(hdrs, entityType);
        setMapping(auto);
        setStep(1);
      } catch {
        alert("Failed to parse file. Please ensure it is a valid .xlsx or .csv file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  // ── Mapping helpers ────────────────────────────────────
  // mapping is { dbField: excelColumn }

  function updateMapping(dbField: string, excelCol: string) {
    setMapping((prev) => ({ ...prev, [dbField]: excelCol }));
  }

  function loadSavedMapping(id: string) {
    const found = savedMappings.find((m) => m.id === id);
    if (found) {
      setSelectedMappingId(id);
      setMapping(found.mapping as Record<string, string>);
      setSaveName(found.name);
    }
  }

  async function saveMapping() {
    if (!saveName.trim()) return;
    setSaveLoading(true);
    try {
      if (selectedMappingId) {
        await fetch("/api/import/mappings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedMappingId,
            name: saveName,
            mapping,
          }),
        });
      } else {
        const res = await fetch("/api/import/mappings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType,
            name: saveName,
            mapping,
          }),
        });
        if (res.ok) {
          const created = await res.json();
          setSelectedMappingId(created.id);
        }
      }
      await fetchSavedMappings();
    } catch {
      // ignore
    }
    setSaveLoading(false);
  }

  async function deleteMapping(id: string) {
    try {
      await fetch(`/api/import/mappings/${id}`, { method: "DELETE" });
      if (selectedMappingId === id) {
        setSelectedMappingId("");
        setSaveName("");
      }
      await fetchSavedMappings();
    } catch {
      // ignore
    }
  }

  // ── Validate ──────────────────────────────────────────

  // mapping is { dbField: excelColumn }
  function getMappedRows(): Record<string, unknown>[] {
    return rawRows.map((row) => {
      const mapped: Record<string, unknown> = {};
      for (const [dbField, excelCol] of Object.entries(mapping)) {
        if (excelCol) mapped[dbField] = row[excelCol];
      }
      return mapped;
    });
  }

  async function runValidation() {
    setValidating(true);
    try {
      const mappedRows = getMappedRows();
      const res = await fetch("/api/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "validate",
          entityType,
          rows: mappedRows,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setValidationResults(data.results);
        setStep(2);
      } else {
        alert(data.error || "Validation failed");
      }
    } catch {
      alert("Validation request failed");
    }
    setValidating(false);
  }

  // ── Import ────────────────────────────────────────────

  async function runImport() {
    setImporting(true);
    try {
      // Only import valid rows
      const mappedRows = getMappedRows();
      const validRows = validationResults
        .filter((r) => r.status !== "error")
        .map((r) => mappedRows[r.rowIndex]);

      const res = await fetch("/api/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import",
          entityType,
          rows: validRows,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult(data);
        setStep(3);
      } else {
        alert(data.error || "Import failed");
      }
    } catch {
      alert("Import request failed");
    }
    setImporting(false);
  }

  // ── Computed ──────────────────────────────────────────

  const requiredFields = fields.filter((f) => f.required);
  // mapping is { dbField: excelColumn } — check that all required fields have a non-empty excelColumn
  const missingRequired = requiredFields.filter((f) => !mapping[f.key]);

  const validCount = validationResults.filter(
    (r) => r.status === "valid"
  ).length;
  const warningCount = validationResults.filter(
    (r) => r.status === "warning"
  ).length;
  const errorCount = validationResults.filter(
    (r) => r.status === "error"
  ).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col mx-4">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Import {entityLabel}</h2>
            <div className="flex items-center gap-2 mt-1">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      i === step
                        ? "bg-primary text-white"
                        : i < step
                        ? "bg-green-100 text-green-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < step ? <Check className="h-3 w-3 inline" /> : i + 1}.{" "}
                    {s}
                  </span>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Step 0: Upload ── */}
          {step === 0 && (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-1">
                  Drag & drop your file here
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Supports .xlsx and .csv files
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
              </div>
              {fileName && (
                <p className="text-sm text-muted-foreground">
                  Selected: <span className="font-medium">{fileName}</span> (
                  {rawRows.length} rows)
                </p>
              )}
            </div>
          )}

          {/* ── Step 1: Map Columns ── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Saved mappings */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <span className="text-sm font-medium">Saved Mappings:</span>
                <select
                  className="border rounded px-2 py-1 text-sm bg-white"
                  value={selectedMappingId}
                  onChange={(e) => {
                    if (e.target.value) loadSavedMapping(e.target.value);
                    else {
                      setSelectedMappingId("");
                      setSaveName("");
                    }
                  }}
                >
                  <option value="">-- Select --</option>
                  {savedMappings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {selectedMappingId && (
                  <button
                    onClick={() => deleteMapping(selectedMappingId)}
                    className="text-red-500 hover:text-red-700"
                    title="Delete mapping"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <div className="flex-1" />
                <Input
                  placeholder="Mapping name..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-48 h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveMapping}
                  disabled={!saveName.trim() || saveLoading}
                >
                  {saveLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Save
                </Button>
              </div>

              {/* Required fields status */}
              {missingRequired.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">
                      Missing required mappings:{" "}
                    </span>
                    {missingRequired.map((f) => f.label).join(", ")}
                  </div>
                </div>
              )}

              {/* Mapping table — DB fields on left, Excel columns on right */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-left">
                      <th className="px-4 py-2 font-medium w-8">#</th>
                      <th className="px-4 py-2 font-medium">
                        System Field
                      </th>
                      <th className="px-4 py-2 font-medium">
                        Excel Column
                      </th>
                      <th className="px-4 py-2 font-medium w-32">
                        Sample Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, idx) => {
                      const selectedCol = mapping[field.key] || "";
                      const sampleValue = selectedCol && rawRows.length > 0
                        ? String(rawRows[0][selectedCol] ?? "")
                        : "";
                      return (
                        <tr key={field.key} className={`border-t ${field.required && !selectedCol ? "bg-amber-50/50" : ""}`}>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{idx + 1}</td>
                          <td className="px-4 py-2">
                            <span className="font-medium">{field.label}</span>
                            {field.required && (
                              <span className="ml-1 text-xs text-red-500 font-semibold">*</span>
                            )}
                            {!field.required && (
                              <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <select
                              className="border rounded px-2 py-1 text-sm bg-white w-full"
                              value={selectedCol}
                              onChange={(e) =>
                                updateMapping(field.key, e.target.value)
                              }
                            >
                              <option value="">-- Skip --</option>
                              {headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[150px]">
                            {sampleValue}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview & Validate ── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Valid: {validCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>Warnings: {warningCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Errors: {errorCount}</span>
                </div>
                <div className="flex-1" />
                <span className="text-muted-foreground">
                  {rawRows.length} total rows
                </span>
              </div>

              {/* Preview table */}
              <div className="border rounded-lg overflow-auto max-h-[400px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium w-8">
                        #
                      </th>
                      <th className="px-3 py-2 text-left font-medium w-16">
                        Status
                      </th>
                      {fields
                        .filter((f) => !!mapping[f.key])
                        .map((f) => (
                          <th
                            key={f.key}
                            className="px-3 py-2 text-left font-medium whitespace-nowrap"
                          >
                            {f.label}
                          </th>
                        ))}
                      <th className="px-3 py-2 text-left font-medium">
                        Issues
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResults.map((vr) => {
                      const mappedRow = getMappedRows()[vr.rowIndex];
                      return (
                        <tr
                          key={vr.rowIndex}
                          className={`border-t ${
                            vr.status === "error"
                              ? "bg-red-50"
                              : vr.status === "warning"
                              ? "bg-amber-50"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {vr.rowIndex + 1}
                          </td>
                          <td className="px-3 py-1.5">
                            {vr.status === "valid" && (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                            {vr.status === "warning" && (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                            {vr.status === "error" && (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </td>
                          {fields
                            .filter((f) => !!mapping[f.key])
                            .map((f) => (
                              <td
                                key={f.key}
                                className="px-3 py-1.5 max-w-[120px] truncate"
                              >
                                {String(mappedRow?.[f.key] ?? "")}
                              </td>
                            ))}
                          <td className="px-3 py-1.5">
                            {[...vr.errors, ...vr.warnings].map((err, j) => (
                              <span
                                key={j}
                                className={`block text-xs ${
                                  vr.errors.includes(err)
                                    ? "text-red-600"
                                    : "text-amber-600"
                                }`}
                              >
                                {err.message}
                              </span>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {errorCount > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>
                    {errorCount} row(s) have errors and will be skipped.{" "}
                    {validCount + warningCount} row(s) will be imported.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Results ── */}
          {step === 3 && importResult && (
            <div className="space-y-4">
              <div className="text-center py-8">
                {importResult.success > 0 ? (
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                ) : (
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                  </div>
                )}
                <h3 className="text-xl font-semibold mb-2">Import Complete</h3>
                <div className="flex items-center justify-center gap-6 text-sm">
                  <span className="text-green-600 font-medium">
                    {importResult.success} imported
                  </span>
                  {importResult.failed > 0 && (
                    <span className="text-red-600 font-medium">
                      {importResult.failed} failed
                    </span>
                  )}
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-[300px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">
                          Row
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Error
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.errors.map((err, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-4 py-2 text-muted-foreground">
                            {err.row}
                          </td>
                          <td className="px-4 py-2 text-red-600">
                            {err.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/10">
          <div>
            {step > 0 && step < 3 && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step < 3 && (
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            {step === 1 && (
              <Button
                onClick={runValidation}
                disabled={
                  missingRequired.length > 0 || validating || rawRows.length === 0
                }
              >
                {validating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                Validate
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={runImport}
                disabled={
                  importing || validCount + warningCount === 0
                }
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Import {validCount + warningCount} Rows
              </Button>
            )}
            {step === 3 && (
              <Button onClick={onSuccess}>
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
