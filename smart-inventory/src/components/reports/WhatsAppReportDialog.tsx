"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send, CheckCircle, AlertCircle, MessageCircle } from "lucide-react";

// ── Types ──────────────────────────────────────────
interface OutstandingInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  balanceAmount: number;
  partyId: string;
  partyName: string;
  partyPhone?: string;
}

interface GroupedCustomer {
  id: string;
  name: string;
  phone: string;
  invoices: { invoiceNumber: string; invoiceDate: string; balanceAmount: number }[];
  totalOutstanding: number;
}

interface SendResult {
  name: string;
  phone: string;
  success: boolean;
  error?: string;
}

interface WhatsAppReportDialogProps {
  invoices: OutstandingInvoice[];
  companyName: string;
  disabled?: boolean;
}

export function WhatsAppReportDialog({
  invoices,
  companyName,
  disabled,
}: WhatsAppReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);

  // Group invoices by customer and filter those with phone numbers
  const grouped = useMemo(() => {
    const map = new Map<string, GroupedCustomer>();
    for (const inv of invoices) {
      if (!inv.partyId) continue;
      const existing = map.get(inv.partyId);
      if (existing) {
        existing.invoices.push({
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          balanceAmount: inv.balanceAmount,
        });
        existing.totalOutstanding += inv.balanceAmount;
      } else {
        map.set(inv.partyId, {
          id: inv.partyId,
          name: inv.partyName,
          phone: inv.partyPhone || "",
          invoices: [
            {
              invoiceNumber: inv.invoiceNumber,
              invoiceDate: inv.invoiceDate,
              balanceAmount: inv.balanceAmount,
            },
          ],
          totalOutstanding: inv.balanceAmount,
        });
      }
    }
    return Array.from(map.values());
  }, [invoices]);

  const withPhone = grouped.filter((c) => c.phone.length >= 10);
  const withoutPhone = grouped.filter((c) => c.phone.length < 10);

  const handleOpen = () => {
    setResults(null);
    // Auto-select all customers with phone numbers
    setSelected(new Set(withPhone.map((c) => c.id)));
    setOpen(true);
  };

  const toggleCustomer = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === withPhone.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(withPhone.map((c) => c.id)));
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    setResults(null);
    try {
      const customers = withPhone
        .filter((c) => selected.has(c.id))
        .map((c) => ({
          name: c.name,
          phone: c.phone,
          invoices: c.invoices,
          totalOutstanding: c.totalOutstanding,
        }));

      const res = await fetch("/api/whatsapp/send-outstanding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers, companyName }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to send");
      }

      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      setResults([
        {
          name: "All",
          phone: "",
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const sentCount = results?.filter((r) => r.success).length ?? 0;
  const failedCount = results?.filter((r) => !r.success).length ?? 0;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={disabled}
        className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Send Outstanding Report via WhatsApp
            </DialogTitle>
          </DialogHeader>

          {/* Results view */}
          {results ? (
            <div className="flex-1 overflow-y-auto space-y-3 py-2">
              {/* Summary */}
              <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-50">
                {sentCount > 0 && (
                  <span className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
                    <CheckCircle className="h-4 w-4" /> {sentCount} sent
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
                    <AlertCircle className="h-4 w-4" /> {failedCount} failed
                  </span>
                )}
              </div>

              {/* Per-customer results */}
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    r.success
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-gray-500">{r.phone}</p>
                  </div>
                  {r.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <p className="text-xs text-red-600 max-w-[200px] text-right">{r.error}</p>
                  )}
                </div>
              ))}

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              {/* Customer selection */}
              <div className="flex-1 overflow-y-auto space-y-1 py-2">
                {/* Select all */}
                {withPhone.length > 1 && (
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 border-b pb-3 mb-2">
                    <Checkbox
                      checked={selected.size === withPhone.length}
                      onCheckedChange={toggleAll}
                    />
                    <span className="text-sm font-medium">
                      Select All ({withPhone.length} customers)
                    </span>
                  </div>
                )}

                {withPhone.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggleCustomer(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.phone}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-red-600">
                        ₹{fmt(c.totalOutstanding)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {c.invoices.length} inv
                      </p>
                    </div>
                  </div>
                ))}

                {/* Customers without phone */}
                {withoutPhone.length > 0 && (
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-xs text-amber-600 font-medium mb-1">
                      No phone number ({withoutPhone.length}):
                    </p>
                    {withoutPhone.map((c) => (
                      <p key={c.id} className="text-xs text-gray-400 pl-2">
                        {c.name} — ₹{fmt(c.totalOutstanding)}
                      </p>
                    ))}
                  </div>
                )}

                {withPhone.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No customers with phone numbers found.
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={selected.size === 0 || isSending}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending ({selected.size})...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send to {selected.size} customer{selected.size !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
