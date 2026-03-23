"use client";

import { useState, useEffect, useRef } from "react";
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
  FileSpreadsheet,
  FileText,
  Download,
  BookMarked,
  Save,
  Trash2,
} from "lucide-react";
import {
  ENTITY_FIELDS,
  type EntityType,
  type ImportField,
} from "@/lib/import-utils";
import * as XLSX from "xlsx";
import { tryParseVendorInvoice } from "@/lib/vendor-invoice-parser";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entityType: EntityType;
  entityLabel: string;
}

interface RowValidation {
  rowIndex: number;
  status: "valid" | "error" | "warning";
  errors: { field: string; message: string }[];
  warnings: { field: string; message: string }[];
  resolvedData: Record<string, unknown>;
}

const STEPS = ["Upload", "Map Columns", "Preview", "Results"];

// Sample row values keyed by field key — shown in the downloadable template
const SAMPLE_VALUES: Record<string, Record<string, string>> = {
  CUSTOMER: { name: "Ramesh Traders", gstin: "29ABCDE1234F1Z5", email: "ramesh@example.com", phone: "9876543210", address: "12 Market Road", city: "Bangalore", state: "Karnataka", pincode: "560001", openingBalance: "0", creditLimit: "50000", creditDays: "30" },
  VENDOR: { name: "Sunrise Supplies", gstin: "27FGHIJ5678K2Y4", email: "sunrise@example.com", phone: "9123456789", address: "45 Industrial Area", city: "Mumbai", state: "Maharashtra", pincode: "400001", openingBalance: "0", creditDays: "15" },
  ITEM: { name: "Premium Basmati Rice 5kg", brandName: "Fortune", subBrandName: "Basmati", userCode: "BAS5KG", hsnCode: "10063020", gstRate: "5", purchasePrice: "320", mrp: "450", sellingPrice: "430", unit: "BAG", minStock: "10", description: "Premium quality basmati rice" },
  EMPLOYEE: { name: "Anita Sharma", email: "anita@company.com", phone: "9988776655", designation: "Sales Executive", department: "Sales", salary: "25000", joinDate: "2024-01-15" },
  STOCK_JOURNAL: { itemName: "Premium Basmati Rice 5kg", date: "2024-03-01", quantity: "50", type: "ADJUSTMENT_IN", reason: "Opening stock" },
  PAYMENT: { customerName: "Ramesh Traders", paymentDate: "2024-03-01", amount: "15000", mode: "BANK_TRANSFER", bankAccountName: "HDFC Business", referenceNumber: "TXN123456", notes: "March payment" },
  VENDOR_PAYMENT: { vendorName: "Sunrise Supplies", date: "2024-03-01", amount: "20000", mode: "CHEQUE", paidFrom: "HDFC Business", bankAccountName: "HDFC Business", reference: "CHQ001234", notes: "" },
  SALES_INVOICE: { invoiceNumber: "SI-001", invoiceDate: "2024-03-01", customerName: "Ramesh Traders", dueDate: "2024-03-31", itemName: "Premium Basmati Rice 5kg", quantity: "10", rate: "430", discountPercent: "0", taxRate: "5", notes: "", ref: "" },
  PURCHASE_INVOICE: { invoiceNumber: "PI-001", date: "2024-03-01", dueDate: "2024-03-15", vendorName: "Sunrise Supplies", itemName: "Premium Basmati Rice 5kg", quantity: "50", rate: "320", taxRate: "5", notes: "", ref: "" },
};

function downloadSampleFile(entityType: EntityType, entityLabel: string) {
  const fields = ENTITY_FIELDS[entityType];
  const sample = SAMPLE_VALUES[entityType] || {};
  const headers = fields.map((f) => f.label);
  const row = fields.map((f) => sample[f.key] ?? "");
  const ws = XLSX.utils.aoa_to_sheet([headers, row]);
  // Style header row width
  ws["!cols"] = headers.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, entityLabel);
  XLSX.writeFile(wb, `${entityLabel}-sample.xlsx`);
}

// ── Reusable mapping table ─────────────────────────────────────────────────
function MappingTable({
  fields,
  headers,
  mapping,
  rawRows,
  onUpdate,
}: {
  fields: ImportField[];
  headers: string[];
  mapping: Record<string, string>;
  rawRows: Record<string, unknown>[];
  onUpdate: (field: string, col: string) => void;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 text-left">
            <th className="px-3 py-2 font-medium w-6" />
            <th className="px-3 py-2 font-medium">System Field</th>
            <th className="px-3 py-2 font-medium">File Column</th>
            <th className="px-3 py-2 font-medium w-36">Sample Value</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const selectedCol = mapping[field.key] || "";
            const isMapped = !!selectedCol;
            const sampleValue = isMapped && rawRows.length > 0
              ? String(rawRows[0][selectedCol] ?? "")
              : "";
            const dotColor = isMapped
              ? "bg-teal-500"
              : field.required
                ? "bg-red-400"
                : "bg-gray-300";

            return (
              <tr key={field.key} className={`border-t ${field.required && !isMapped ? "bg-red-50/40" : isMapped ? "bg-teal-50/20" : ""}`}>
                <td className="px-3 py-2.5">
                  <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-medium text-gray-800">{field.label}</span>
                  {field.required && <span className="ml-1 text-red-500 font-bold text-xs">*</span>}
                  {field.unit && (
                    <span className={`ml-1.5 text-[10px] font-semibold px-1 py-0.5 rounded ${field.unit === '%' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {field.unit}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <select
                    className={`border rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                      isMapped ? "border-teal-300 bg-white" : field.required ? "border-red-300 bg-red-50" : "bg-white"
                    }`}
                    value={selectedCol}
                    onChange={(e) => onUpdate(field.key, e.target.value)}
                  >
                    <option value="">— Skip —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[140px]">
                  {sampleValue}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

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
  const [vendorInvoiceInfo, setVendorInvoiceInfo] = useState<string | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfParseError, setPdfParseError] = useState<string | null>(null);

  // Step 2: Mapping
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Saved mappings
  const [savedMappings, setSavedMappings] = useState<{ id: string; name: string; mapping: Record<string, string> }[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState("");
  const [saveAsName, setSaveAsName] = useState("");
  const [savingMapping, setSavingMapping] = useState(false);

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
      setValidationResults([]);
      setImportResult(null);
      setVendorInvoiceInfo(null);
      setPdfParsing(false);
      setPdfParseError(null);
      setSavedMappings([]);
      setSelectedSavedId("");
      setSaveAsName("");
    }
  }, [isOpen, entityType]);

  // Fetch saved mappings when reaching the mapping step
  useEffect(() => {
    if (step !== 1) return;
    fetch(`/api/import/mappings?entityType=${entityType}`)
      .then(r => r.json())
      .then(d => setSavedMappings(d.mappings ?? []))
      .catch(() => {});
  }, [step, entityType]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // ── File parsing ───────────────────────────────────────

  const isInvoiceType = entityType === "SALES_INVOICE" || entityType === "PURCHASE_INVOICE";

  async function processPdfFile(file: File) {
    setPdfParsing(true);
    setPdfParseError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("invoiceType", entityType === "SALES_INVOICE" ? "SALES" : "PURCHASE");
      const res = await fetch("/api/import/parse-pdf", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "PDF parsing failed");

      // Build an in-memory workbook to run vendor-format detection
      const ws = XLSX.utils.json_to_sheet(data.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Invoice");

      const vendorResult = tryParseVendorInvoice(wb);
      if (vendorResult) {
        setFileName(file.name);
        setHeaders(vendorResult.headers);
        setRawRows(vendorResult.rows);
        setVendorInvoiceInfo(vendorResult.info);
        setMapping(buildAutoMapping(fields, vendorResult.headers));
        setStep(1);
        return;
      }

      setFileName(file.name);
      setHeaders(data.headers);
      setRawRows(data.rows);
      setVendorInvoiceInfo(data.info);
      setMapping(buildAutoMapping(fields, data.headers));
      setStep(1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "PDF parsing failed";
      setPdfParseError(msg);
    } finally {
      setPdfParsing(false);
    }
  }

  function processExcelFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // Auto-detect vendor invoice format (PDF-to-Excel)
        const vendorResult = tryParseVendorInvoice(workbook);
        if (vendorResult) {
          setFileName(file.name);
          setHeaders(vendorResult.headers);
          setRawRows(vendorResult.rows);
          setVendorInvoiceInfo(vendorResult.info);
          setMapping(buildAutoMapping(fields, vendorResult.headers));
          setStep(1);
          return;
        }

        // Normal flat file parsing
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        if (json.length === 0) {
          alert("File is empty or has no data rows.");
          return;
        }

        const hdrs = Object.keys(json[0]);
        setFileName(file.name);
        setHeaders(hdrs);
        setRawRows(json);
        setVendorInvoiceInfo(null);
        setMapping(buildAutoMapping(fields, hdrs));
        setStep(1);
      } catch {
        alert("Failed to parse file. Please ensure it is a valid .xlsx or .csv file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function processFile(file: File) {
    if (file.name.toLowerCase().endsWith(".pdf")) {
      if (!isInvoiceType) {
        alert("PDF upload is only supported for Sales and Purchase Invoices.");
        return;
      }
      processPdfFile(file);
    } else {
      processExcelFile(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  // ── Mapping helpers ────────────────────────────────────
  // mapping is { dbField: excelColumn }

  function buildAutoMapping(fieldList: ImportField[], columnHeaders: string[]): Record<string, string> {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const result: Record<string, string> = {};
    for (const field of fieldList) {
      const candidates = [field.label, ...(field.aliases ?? [])].map(norm);
      for (const header of columnHeaders) {
        if (candidates.includes(norm(header))) {
          result[field.key] = header;
          break;
        }
      }
    }
    return result;
  }

  function updateMapping(dbField: string, excelCol: string) {
    setMapping((prev) => ({ ...prev, [dbField]: excelCol }));
  }

  function applyTemplate(id: string) {
    const tpl = savedMappings.find(m => m.id === id);
    if (!tpl) return;
    // Only apply entries whose column value exists in the current file's headers
    const merged: Record<string, string> = { ...mapping };
    for (const [field, col] of Object.entries(tpl.mapping)) {
      if (headers.includes(col)) merged[field] = col;
    }
    setMapping(merged);
    setSelectedSavedId(id);
  }

  async function saveCurrentMapping() {
    const name = saveAsName.trim();
    if (!name) return;
    setSavingMapping(true);
    try {
      // Check if a mapping with this name already exists
      const existing = savedMappings.find(m => m.name === name);
      const res = await fetch("/api/import/mappings" + (existing ? "" : ""), {
        method: existing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existing
          ? { id: existing.id, mapping }
          : { entityType, name, mapping }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Failed to save mapping");
        return;
      }
      const saved = await res.json();
      setSavedMappings(prev =>
        existing
          ? prev.map(m => m.id === existing.id ? { ...m, mapping } : m)
          : [...prev, saved]
      );
      setSelectedSavedId(saved.id);
      setSaveAsName("");
    } catch {
      alert("Failed to save mapping");
    } finally {
      setSavingMapping(false);
    }
  }

  async function deleteSavedMapping(id: string) {
    if (!confirm("Delete this saved mapping?")) return;
    try {
      await fetch(`/api/import/mappings/${id}`, { method: "DELETE" });
      setSavedMappings(prev => prev.filter(m => m.id !== id));
      if (selectedSavedId === id) setSelectedSavedId("");
    } catch {
      alert("Failed to delete mapping");
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
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {pdfParsing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-teal-500" />
                    <p className="text-sm font-medium text-gray-600">Converting PDF to Excel…</p>
                    <p className="text-xs text-muted-foreground">Extracting invoice data and downloading Excel</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <FileSpreadsheet className="h-9 w-9 text-muted-foreground" />
                      {isInvoiceType && <FileText className="h-9 w-9 text-muted-foreground" />}
                    </div>
                    <p className="text-lg font-medium mb-1">Drag &amp; drop your file here</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      {isInvoiceType
                        ? "Supports .xlsx, .csv and .pdf files"
                        : "Supports .xlsx and .csv files"}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={isInvoiceType ? ".xlsx,.xls,.csv,.pdf" : ".xlsx,.xls,.csv"}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="flex items-center justify-center gap-3">
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose File
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => downloadSampleFile(entityType, entityLabel)}
                        className="text-teal-700 border-teal-200 hover:bg-teal-50"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Sample
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {pdfParseError && (
                <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">PDF could not be parsed</p>
                    <p className="mt-0.5">{pdfParseError}</p>
                  </div>
                </div>
              )}

              {fileName && !pdfParsing && (
                <p className="text-sm text-muted-foreground">
                  Selected: <span className="font-medium">{fileName}</span> ({rawRows.length} rows)
                </p>
              )}
            </div>
          )}

          {/* ── Step 1: Map Columns ── */}
          {step === 1 && (
            <div className="space-y-3">
              {vendorInvoiceInfo && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <span className="text-blue-800">{vendorInvoiceInfo}</span>
                </div>
              )}

              {/* ── Saved mapping templates ── */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 border rounded-lg">
                <BookMarked className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-muted-foreground mr-1">Templates:</span>

                {/* Apply saved mapping */}
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <select
                    className="border rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 flex-1 min-w-0"
                    value={selectedSavedId}
                    onChange={e => applyTemplate(e.target.value)}
                  >
                    <option value="">— Load a saved template —</option>
                    {savedMappings.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  {selectedSavedId && (
                    <button
                      onClick={() => deleteSavedMapping(selectedSavedId)}
                      className="p-1 text-red-400 hover:text-red-600 shrink-0"
                      title="Delete this template"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="w-px h-5 bg-border mx-1 hidden sm:block" />

                {/* Save current mapping */}
                <div className="flex items-center gap-1">
                  <Input
                    placeholder="Save as…"
                    value={saveAsName}
                    onChange={e => setSaveAsName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveCurrentMapping(); }}
                    className="h-8 text-sm w-36"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={saveCurrentMapping}
                    disabled={!saveAsName.trim() || savingMapping}
                    className="h-8 px-2"
                    title="Save current mapping as template"
                  >
                    {savingMapping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {missingRequired.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium">Required fields not mapped: </span>
                    {missingRequired.map((f) => f.label).join(", ")}
                  </span>
                </div>
              )}
              <MappingTable
                fields={fields}
                headers={headers}
                mapping={mapping}
                rawRows={rawRows}
                onUpdate={updateMapping}
              />
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
