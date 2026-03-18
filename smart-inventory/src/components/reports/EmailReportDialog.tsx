"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail,
  Plus,
  Trash2,
  Star,
  Loader2,
  Send,
  CheckCircle,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────
type DateMode = "range" | "month" | "quarter";

interface Recipient {
  id: string;
  email: string;
  name: string | null;
  isDefault: boolean;
}

export interface EmailReportDialogProps {
  reportTitle: string;
  /** Pre-fill from the current page's active date range */
  defaultStartDate?: string;
  defaultEndDate?: string;
  /** Set to false for reports with no date filter (closing stock, reorders) */
  hasDateFilter?: boolean;
  /**
   * Called when the user clicks Send.
   * Parent is responsible for:
   *   1. Fetching report data for (startDate, endDate)
   *   2. Generating PDF as base64 with generatePDFBase64()
   *   3. POSTing to /api/reports/send-email
   * Throw an Error to surface it in the dialog.
   */
  onSendEmail: (
    emails: string[],
    startDate: string,
    endDate: string
  ) => Promise<void>;
  disabled?: boolean;
}

// ── Month names ─────────────────────────────────────────────────
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ── Component ───────────────────────────────────────────────────
export function EmailReportDialog({
  reportTitle,
  defaultStartDate = "",
  defaultEndDate = "",
  hasDateFilter = true,
  onSendEmail,
  disabled = false,
}: EmailReportDialogProps) {
  const [open, setOpen] = useState(false);

  // ── Date state ─────────────────────────────────────────────
  const [dateMode, setDateMode] = useState<DateMode>("range");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(1);

  // ── Recipient state ────────────────────────────────────────
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // ── Send state ─────────────────────────────────────────────
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  // ── Fetch recipients (only when dialog is open) ────────────
  const { data, mutate } = useSWR(open ? "/api/email-recipients" : null);
  const recipients: Recipient[] = data?.recipients || [];

  // Auto-select the default recipient when recipients first load
  useEffect(() => {
    if (open && recipients.length > 0 && selectedEmails.size === 0) {
      const def = recipients.find((r) => r.isDefault);
      if (def) setSelectedEmails(new Set([def.email]));
    }
  // Only run once when dialog opens and recipients arrive
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipients.length]);

  // ── Compute effective dates ────────────────────────────────
  const getEffectiveDates = (): { from: string; to: string } => {
    if (!hasDateFilter) return { from: "", to: "" };

    if (dateMode === "range") return { from: startDate, to: endDate };

    if (dateMode === "month") {
      const m = String(selectedMonth + 1).padStart(2, "0");
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      return {
        from: `${selectedYear}-${m}-01`,
        to: `${selectedYear}-${m}-${lastDay}`,
      };
    }

    // Quarter (Indian FY: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar next yr)
    const qMap: Record<number, { from: string; to: string }> = {
      1: { from: `${selectedYear}-04-01`, to: `${selectedYear}-06-30` },
      2: { from: `${selectedYear}-07-01`, to: `${selectedYear}-09-30` },
      3: { from: `${selectedYear}-10-01`, to: `${selectedYear}-12-31` },
      4: { from: `${selectedYear + 1}-01-01`, to: `${selectedYear + 1}-03-31` },
    };
    return qMap[selectedQuarter];
  };

  // ── Handle dialog open/close ───────────────────────────────
  const handleOpenChange = (val: boolean) => {
    if (val) {
      // Re-sync from props when opening
      setStartDate(defaultStartDate);
      setEndDate(defaultEndDate);
      setSendError(null);
      setSendSuccess(false);
      setNewEmail("");
      setNewName("");
      // Reset selection so useEffect above can re-apply default
      setSelectedEmails(new Set());
    }
    setOpen(val);
  };

  // ── Send handler ───────────────────────────────────────────
  const handleSend = async () => {
    const emailList = Array.from(selectedEmails);
    if (!emailList.length) {
      setSendError("Please select at least one recipient.");
      return;
    }

    const { from, to } = getEffectiveDates();

    if (hasDateFilter && dateMode === "range" && (!from || !to)) {
      setSendError("Please select a valid date range.");
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      await onSendEmail(emailList, from, to);
      setSendSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSendSuccess(false);
      }, 2000);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send email. Check SMTP settings.");
    } finally {
      setIsSending(false);
    }
  };

  // ── Add recipient ──────────────────────────────────────────
  const handleAddRecipient = async () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setSendError("Invalid email address.");
      return;
    }

    setIsAdding(true);
    setSendError(null);
    try {
      const res = await fetch("/api/email-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, name: newName.trim() || undefined }),
      });

      const d = await res.json();
      if (!res.ok) {
        setSendError(d.error || "Failed to add recipient.");
        return;
      }

      mutate();
      setNewEmail("");
      setNewName("");
      // Auto-select newly added
      setSelectedEmails((prev) => new Set([...prev, d.recipient.email]));
    } finally {
      setIsAdding(false);
    }
  };

  // ── Remove recipient ───────────────────────────────────────
  const handleRemove = async (id: string, email: string) => {
    if (!confirm(`Remove "${email}" from the list?`)) return;
    await fetch(`/api/email-recipients/${id}`, { method: "DELETE" });
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      next.delete(email);
      return next;
    });
    mutate();
  };

  // ── Set default ────────────────────────────────────────────
  const handleSetDefault = async (id: string) => {
    await fetch(`/api/email-recipients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    mutate();
  };

  // ── Toggle email selection ─────────────────────────────────
  const toggleSelect = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const allSelected = recipients.length > 0 && recipients.every((r) => selectedEmails.has(r.email));

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      {/* Trigger button */}
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5"
      >
        <Mail className="h-4 w-4" />
        Email Report
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="h-5 w-5 text-blue-600" />
              Email {reportTitle}
            </DialogTitle>
          </DialogHeader>

          {/* ── Date Filter Section ── */}
          {hasDateFilter && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-700">
                Report Period
              </Label>

              {/* Mode switcher */}
              <div className="flex bg-gray-100 rounded-lg p-1 w-fit gap-1">
                {(["range", "month", "quarter"] as DateMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setDateMode(mode)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      dateMode === mode
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {mode === "range" ? "Date Range" : mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>

              {/* Date Range */}
              {dateMode === "range" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">From</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">To</Label>
                    <Input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Month */}
              {dateMode === "month" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Month</Label>
                    <Select
                      value={String(selectedMonth)}
                      onValueChange={(v) => setSelectedMonth(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Year</Label>
                    <Input
                      type="number"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      min={2000}
                      max={2100}
                    />
                  </div>
                </div>
              )}

              {/* Quarter */}
              {dateMode === "quarter" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Quarter (Indian FY)</Label>
                    <Select
                      value={String(selectedQuarter)}
                      onValueChange={(v) => setSelectedQuarter(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Q1 (Apr – Jun)</SelectItem>
                        <SelectItem value="2">Q2 (Jul – Sep)</SelectItem>
                        <SelectItem value="3">Q3 (Oct – Dec)</SelectItem>
                        <SelectItem value="4">Q4 (Jan – Mar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">FY Start Year (e.g. 2025)</Label>
                    <Input
                      type="number"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      min={2000}
                      max={2100}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="border-t" />

          {/* ── Email Recipients Section ── */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-gray-700">
              Email Recipients
            </Label>

            {/* Add new email */}
            <div className="flex gap-2">
              <Input
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddRecipient()}
                className="flex-1"
              />
              <Input
                placeholder="Name (optional)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-32"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddRecipient}
                disabled={isAdding || !newEmail.trim()}
                title="Add recipient"
              >
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Recipients list */}
            {recipients.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
                No recipients saved yet. Add an email above.
              </p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                {/* Select all row */}
                <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedEmails(new Set(recipients.map((r) => r.email)));
                      } else {
                        setSelectedEmails(new Set());
                      }
                    }}
                  />
                  <span className="text-xs text-gray-500 font-medium">
                    Select all ({recipients.length})
                  </span>
                </div>

                {/* Recipient rows */}
                <div className="max-h-48 overflow-y-auto divide-y">
                  {recipients.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedEmails.has(r.email)}
                        onCheckedChange={() => toggleSelect(r.email)}
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {r.email}
                        </p>
                        {r.name && (
                          <p className="text-xs text-gray-400 truncate">{r.name}</p>
                        )}
                      </div>

                      {r.isDefault && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                          Default
                        </span>
                      )}

                      {/* Set default star */}
                      <button
                        onClick={() => handleSetDefault(r.id)}
                        title={r.isDefault ? "Default recipient" : "Set as default"}
                        className={`transition-colors shrink-0 ${
                          r.isDefault
                            ? "text-yellow-500"
                            : "text-gray-300 hover:text-yellow-400"
                        }`}
                      >
                        <Star
                          className="h-4 w-4"
                          fill={r.isDefault ? "currentColor" : "none"}
                        />
                      </button>

                      {/* Remove */}
                      <button
                        onClick={() => handleRemove(r.id, r.email)}
                        title="Remove recipient"
                        className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Status Messages ── */}
          {sendError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              {sendError}
            </p>
          )}
          {sendSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Report sent successfully!
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || selectedEmails.size === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                  {selectedEmails.size > 0 && ` (${selectedEmails.size})`}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
