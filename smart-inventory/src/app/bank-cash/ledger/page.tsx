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
import { Loader2, Search, BookOpen } from "lucide-react";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { exportToExcel, exportToPDF, fmtNum, fmtDateExport } from "@/lib/export-utils";
import { useState, useEffect, useCallback } from "react";

interface BankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  accountType: string;
  openingBalance: number;
  currentBalance: number;
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
}

interface LedgerSummary {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

const TYPE_LABELS: Record<string, string> = {
  OPENING_BALANCE: "Opening Balance",
  SALES_RECEIPT: "Sales Receipt",
  PURCHASE_PAYMENT: "Purchase Payment",
  ADJUSTMENT: "Adjustment",
  SALES_INVOICE: "Sales Invoice",
  SALES_RETURN: "Sales Return",
  PURCHASE_INVOICE: "Purchase Invoice",
  PURCHASE_RETURN: "Purchase Return",
};

export default function BankLedgerPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);

  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch bank accounts on mount
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch("/api/bank-accounts?activeOnly=true");
        if (response.ok) {
          const data = await response.json();
          setBankAccounts(data.bankAccounts || []);
        }
      } catch (err) {
        console.error("Error fetching bank accounts:", err);
      } finally {
        setIsLoadingAccounts(false);
      }
    };
    fetchAccounts();
  }, []);

  // Fetch ledger entries
  const fetchLedger = useCallback(async () => {
    if (!selectedAccountId) {
      setEntries([]);
      setSummary(null);
      setBankAccount(null);
      return;
    }

    try {
      setIsLoadingLedger(true);
      setError(null);

      let url = `/api/ledger/bank-accounts/${selectedAccountId}?limit=500`;
      if (fromDate) url += `&fromDate=${fromDate}`;
      if (toDate) url += `&toDate=${toDate}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch ledger");

      const data = await response.json();
      setEntries(data.entries || []);
      setSummary(data.summary || null);
      setBankAccount(data.bankAccount || null);
    } catch (err) {
      console.error("Error fetching ledger:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch ledger");
    } finally {
      setIsLoadingLedger(false);
    }
  }, [selectedAccountId, fromDate, toDate]);

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

  const handleExportExcel = () => {
    if (!entries.length || !summary || !bankAccount) return;
    const headers = ["Date", "Particulars", "Type", "Debit (Out)", "Credit (In)", "Balance"];
    const rows: (string | number)[][] = [];
    rows.push([fromDate ? fmtDateExport(fromDate) : "Opening", "Opening Balance", "-", "-", "-", Math.abs(summary.openingBalance)]);
    entries.forEach((e) => rows.push([fmtDateExport(e.date), e.description, TYPE_LABELS[e.type] || e.type, Number(e.debit) > 0 ? Number(e.debit) : "-", Number(e.credit) > 0 ? Number(e.credit) : "-", Math.abs(e.runningBalance)]));
    rows.push(["Closing", "Closing Balance", "-", summary.totalDebit, summary.totalCredit, Math.abs(summary.closingBalance)]);
    exportToExcel({ fileName: `Bank-Ledger_${bankAccount.accountName}.xlsx`, sheets: [{ name: "Bank Ledger", headers, rows }] });
  };

  const handleExportPDF = () => {
    if (!entries.length || !summary || !bankAccount) return;
    const headers = ["Date", "Particulars", "Type", "Debit (Out)", "Credit (In)", "Balance"];
    const rows: (string | number)[][] = [];
    rows.push([fromDate ? fmtDateExport(fromDate) : "Opening", "Opening Balance", "-", "-", "-", fmtNum(Math.abs(summary.openingBalance))]);
    entries.forEach((e) => rows.push([fmtDateExport(e.date), e.description, TYPE_LABELS[e.type] || e.type, Number(e.debit) > 0 ? fmtNum(Number(e.debit)) : "-", Number(e.credit) > 0 ? fmtNum(Number(e.credit)) : "-", fmtNum(Math.abs(e.runningBalance))]));
    rows.push(["Closing", "Closing Balance", "-", fmtNum(summary.totalDebit), fmtNum(summary.totalCredit), fmtNum(Math.abs(summary.closingBalance))]);
    const dateRange = fromDate && toDate ? `${fmtDateExport(fromDate)} to ${fmtDateExport(toDate)}` : "All dates";
    exportToPDF({ fileName: `Bank-Ledger_${bankAccount.accountName}.pdf`, title: `Bank Ledger — ${bankAccount.accountName}`, subtitle: `${bankAccount.bankName} | ${dateRange}`, sheets: [{ name: "Bank Ledger", headers, rows }] });
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Bank Ledger</h1>
            <p className="text-gray-600">View bank account transaction history</p>
          </div>
          <ExportButtons onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} disabled={entries.length === 0} />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="bankAccount">Bank Account</Label>
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
                disabled={isLoadingAccounts}
              >
                <SelectTrigger id="bankAccount">
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.accountName} ({acc.bankName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={fetchLedger}
                disabled={!selectedAccountId || isLoadingLedger}
                className="bg-teal-500 hover:bg-teal-600"
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
        {summary && bankAccount && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Opening Balance</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(summary.openingBalance)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Total Debit (Out)</p>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(summary.totalDebit)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Total Credit (In)</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(summary.totalCredit)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Closing Balance</p>
              <p className={`text-xl font-bold ${summary.closingBalance >= 0 ? "text-gray-900" : "text-red-600"}`}>
                {formatCurrency(summary.closingBalance)}
              </p>
            </div>
          </div>
        )}

        {/* Ledger Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {!selectedAccountId ? (
            <div className="text-center py-16 text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Select a bank account to view its ledger</p>
            </div>
          ) : isLoadingLedger ? (
            <div className="text-center py-16 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading ledger...</p>
            </div>
          ) : entries.length === 0 && !summary ? (
            <div className="text-center py-16 text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Click &quot;View Ledger&quot; to load transactions</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Particulars</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold text-right">Debit (Out)</TableHead>
                    <TableHead className="font-semibold text-right">Credit (In)</TableHead>
                    <TableHead className="font-semibold text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening Balance Row */}
                  {summary && (
                    <TableRow className="bg-gray-50">
                      <TableCell className="font-medium">
                        {fromDate ? formatDate(fromDate) : "Opening"}
                      </TableCell>
                      <TableCell className="font-medium">Opening Balance</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right font-medium text-gray-900">
                        {formatCurrency(summary.openingBalance)}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Ledger Entries */}
                  {entries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDateOnly(entry.date)}
                      </TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[entry.type] || entry.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {Number(entry.debit) > 0 ? formatCurrency(Number(entry.debit)) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {Number(entry.credit) > 0 ? formatCurrency(Number(entry.credit)) : "-"}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${entry.runningBalance >= 0 ? "text-gray-900" : "text-red-600"}`}>
                        {formatCurrency(entry.runningBalance)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Closing Balance Row */}
                  {summary && (
                    <TableRow className="bg-gray-100 font-semibold">
                      <TableCell>{toDate ? formatDate(toDate) : "Total"}</TableCell>
                      <TableCell>Closing Balance</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(summary.totalDebit)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(summary.totalCredit)}
                      </TableCell>
                      <TableCell className={`text-right ${summary.closingBalance >= 0 ? "text-gray-900" : "text-red-600"}`}>
                        {formatCurrency(summary.closingBalance)}
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
