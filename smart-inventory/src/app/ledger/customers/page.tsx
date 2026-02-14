"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, BookOpen, Users, Truck } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Party {
  id: string;
  number: string;
  name: string;
  openingBalance: number;
}

interface LedgerEntry {
  id: string;
  date: string;
  createdAt: string;
  description: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
  runningBalance: number;
  referenceType: string;
  referenceId: string;
  referenceNumber: string | null;
  referenceLink: string | null;
  bankDetails: string | null;
}

interface LedgerSummary {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  balanceType: string;
}

type LedgerMode = "customer" | "vendor";

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  OPENING_BALANCE: "Opening Balance",
  SALES_INVOICE: "Sales Invoice",
  SALES_RECEIPT: "Payment",
  SALES_RETURN: "Sales Return",
  ADJUSTMENT: "Adjustment",
};

const VENDOR_TYPE_LABELS: Record<string, string> = {
  OPENING_BALANCE: "Opening Balance",
  PURCHASE_INVOICE: "Purchase Invoice",
  PURCHASE_PAYMENT: "Payment",
  PURCHASE_RETURN: "Purchase Return",
  ADJUSTMENT: "Adjustment",
};

export default function LedgerPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LedgerMode>("customer");
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [party, setParty] = useState<Party | null>(null);

  const [isLoadingParties, setIsLoadingParties] = useState(true);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeLabels = mode === "customer" ? CUSTOMER_TYPE_LABELS : VENDOR_TYPE_LABELS;

  // Fetch parties when mode changes
  useEffect(() => {
    const fetchParties = async () => {
      setIsLoadingParties(true);
      try {
        const endpoint = mode === "customer" ? "/api/customers?limit=1000" : "/api/vendors?limit=1000";
        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();
          const list = mode === "customer" ? (data.customers || []) : (data.vendors || []);
          setParties(
            list.map((p: { id: string; customerNumber?: string; vendorNumber?: string; name: string; openingBalance?: number }) => ({
              id: p.id,
              number: p.customerNumber || p.vendorNumber,
              name: p.name,
              openingBalance: Number(p.openingBalance || 0),
            }))
          );
        }
      } catch (err) {
        console.error("Error fetching parties:", err);
      } finally {
        setIsLoadingParties(false);
      }
    };
    fetchParties();
  }, [mode]);

  // Reset selection when mode changes
  const handleModeChange = (newMode: LedgerMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setSelectedPartyId("");
    setEntries([]);
    setSummary(null);
    setParty(null);
    setError(null);
  };

  // Fetch ledger entries
  const fetchLedger = useCallback(async () => {
    if (!selectedPartyId) {
      setEntries([]);
      setSummary(null);
      setParty(null);
      return;
    }

    try {
      setIsLoadingLedger(true);
      setError(null);

      const base = mode === "customer"
        ? `/api/ledger/customers/${selectedPartyId}`
        : `/api/ledger/vendors/${selectedPartyId}`;
      let url = `${base}?limit=500`;
      if (fromDate) url += `&fromDate=${fromDate}`;
      if (toDate) url += `&toDate=${toDate}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch ledger");

      const data = await response.json();
      setEntries(data.entries || []);
      setSummary(data.summary || null);

      const raw = data.customer || data.vendor || null;
      if (raw) {
        setParty({
          id: raw.id,
          number: raw.customerNumber || raw.vendorNumber,
          name: raw.name,
          openingBalance: Number(raw.openingBalance || 0),
        });
      }
    } catch (err) {
      console.error("Error fetching ledger:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch ledger");
    } finally {
      setIsLoadingLedger(false);
    }
  }, [selectedPartyId, fromDate, toDate, mode]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(Math.abs(amount));
  };

  const formatDateOnly = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Balance display helpers — differs for customer vs vendor
  // Customer: positive = Dr (they owe us), negative = Cr
  // Vendor: positive = Cr (we owe them), negative = Dr
  const getBalanceLabel = (balance: number) => {
    if (mode === "customer") {
      return balance >= 0 ? "Dr" : "Cr";
    }
    return balance >= 0 ? "Cr" : "Dr";
  };

  const getBalanceColor = (balance: number) => {
    if (mode === "customer") {
      return balance >= 0 ? "text-red-600" : "text-green-600";
    }
    // Vendor: positive (Cr = we owe) shows red, negative (Dr = they owe) shows green
    return balance >= 0 ? "text-red-600" : "text-green-600";
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Ledger</h1>
          <p className="text-muted-foreground">
            View transaction history and balances
          </p>
        </div>

        {/* Customer / Vendor Toggle */}
        <div className="flex items-center gap-1 mb-6 bg-muted/40 rounded-lg p-1 w-fit">
          <button
            onClick={() => handleModeChange("customer")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              mode === "customer"
                ? "bg-white shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            Customers
          </button>
          <button
            onClick={() => handleModeChange("vendor")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              mode === "vendor"
                ? "bg-white shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Truck className="h-4 w-4" />
            Vendors
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-border/60 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Party Selection */}
            <div>
              <Label htmlFor="party">
                {mode === "customer" ? "Customer" : "Vendor"}
              </Label>
              <Select
                value={selectedPartyId}
                onValueChange={setSelectedPartyId}
                disabled={isLoadingParties}
              >
                <SelectTrigger id="party">
                  <SelectValue
                    placeholder={`Select ${mode === "customer" ? "customer" : "vendor"}...`}
                  />
                </SelectTrigger>
                <SelectContent>
                  {parties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* From Date */}
            <div>
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            {/* To Date */}
            <div>
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            {/* Search Button */}
            <div className="flex items-end">
              <Button
                onClick={fetchLedger}
                disabled={!selectedPartyId || isLoadingLedger}
                className="bg-primary hover:bg-primary/90"
              >
                {isLoadingLedger ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                View Ledger
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        {summary && party && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-border/60 p-4">
              <p className="text-sm text-muted-foreground">Opening Balance</p>
              <p className={`text-xl font-bold ${getBalanceColor(summary.openingBalance)}`}>
                {formatCurrency(summary.openingBalance)} {getBalanceLabel(summary.openingBalance)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-border/60 p-4">
              <p className="text-sm text-muted-foreground">Total Debit (Dr)</p>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(summary.totalDebit)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-border/60 p-4">
              <p className="text-sm text-muted-foreground">Total Credit (Cr)</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(summary.totalCredit)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-border/60 p-4">
              <p className="text-sm text-muted-foreground">Closing Balance</p>
              <p className={`text-xl font-bold ${getBalanceColor(summary.closingBalance)}`}>
                {formatCurrency(summary.closingBalance)} {getBalanceLabel(summary.closingBalance)}
              </p>
            </div>
          </div>
        )}

        {/* Ledger Table */}
        <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
          {!selectedPartyId ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
              <p>
                Select a {mode === "customer" ? "customer" : "vendor"} to view
                their ledger
              </p>
            </div>
          ) : isLoadingLedger ? (
            <div className="text-center py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading ledger...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
              <p>No transactions found for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Particulars</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Reference</TableHead>
                    <TableHead className="font-semibold">Mode / Bank</TableHead>
                    <TableHead className="font-semibold text-right">
                      Debit (Dr)
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Credit (Cr)
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Balance
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening Balance Row */}
                  {summary && (
                    <TableRow className="bg-muted/20">
                      <TableCell className="font-medium">
                        {fromDate ? formatDate(fromDate) : "Opening"}
                      </TableCell>
                      <TableCell className="font-medium">
                        Opening Balance
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell
                        className={`text-right font-medium ${getBalanceColor(summary.openingBalance)}`}
                      >
                        {formatCurrency(summary.openingBalance)}{" "}
                        {getBalanceLabel(summary.openingBalance)}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Ledger Entries */}
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDateOnly(entry.date)}
                      </TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {typeLabels[entry.type] || entry.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {entry.referenceNumber ? (
                          entry.referenceLink ? (
                            <button
                              onClick={() => router.push(entry.referenceLink!)}
                              className="text-primary hover:text-primary/80 hover:underline text-sm font-medium"
                            >
                              {entry.referenceNumber}
                            </button>
                          ) : (
                            <span className="text-sm">
                              {entry.referenceNumber}
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.bankDetails ? (
                          <span className="text-sm text-muted-foreground">
                            {entry.bankDetails}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {Number(entry.debit) > 0
                          ? formatCurrency(Number(entry.debit))
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {Number(entry.credit) > 0
                          ? formatCurrency(Number(entry.credit))
                          : "-"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${getBalanceColor(entry.runningBalance)}`}
                      >
                        {formatCurrency(entry.runningBalance)}{" "}
                        {getBalanceLabel(entry.runningBalance)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Closing Balance Row */}
                  {summary && (
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell>
                        {toDate ? formatDate(toDate) : "Total"}
                      </TableCell>
                      <TableCell>Closing Balance</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(summary.totalDebit)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(summary.totalCredit)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${getBalanceColor(summary.closingBalance)}`}
                      >
                        {formatCurrency(summary.closingBalance)}{" "}
                        {getBalanceLabel(summary.closingBalance)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
