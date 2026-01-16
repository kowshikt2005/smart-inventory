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
import { useState, useEffect, useCallback } from "react";

interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  openingBalance: number;
}

interface LedgerEntry {
  id: string;
  date: string;
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
  balanceType: string;
}

const TYPE_LABELS: Record<string, string> = {
  OPENING_BALANCE: "Opening Balance",
  SALES_INVOICE: "Sales Invoice",
  SALES_RECEIPT: "Payment",
  SALES_RETURN: "Sales Return",
  ADJUSTMENT: "Adjustment",
};

export default function CustomerLedgerPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch customers on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetch("/api/customers?limit=1000");
        if (response.ok) {
          const data = await response.json();
          setCustomers(data.customers || []);
        }
      } catch (err) {
        console.error("Error fetching customers:", err);
      } finally {
        setIsLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, []);

  // Fetch ledger entries
  const fetchLedger = useCallback(async () => {
    if (!selectedCustomerId) {
      setEntries([]);
      setSummary(null);
      setCustomer(null);
      return;
    }

    try {
      setIsLoadingLedger(true);
      setError(null);

      let url = `/api/ledger/customers/${selectedCustomerId}?limit=500`;
      if (fromDate) {
        url += `&fromDate=${fromDate}`;
      }
      if (toDate) {
        url += `&toDate=${toDate}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch ledger");
      }

      const data = await response.json();
      setEntries(data.entries || []);
      setSummary(data.summary || null);
      setCustomer(data.customer || null);
    } catch (err) {
      console.error("Error fetching ledger:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch ledger");
    } finally {
      setIsLoadingLedger(false);
    }
  }, [selectedCustomerId, fromDate, toDate]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(Math.abs(amount));
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Customer Ledger
          </h1>
          <p className="text-gray-600">
            View customer transaction history and balances
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Customer Selection */}
            <div>
              <Label htmlFor="customer">Customer</Label>
              <Select
                value={selectedCustomerId}
                onValueChange={setSelectedCustomerId}
                disabled={isLoadingCustomers}
              >
                <SelectTrigger id="customer">
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((cust) => (
                    <SelectItem key={cust.id} value={cust.id}>
                      {cust.name} ({cust.customerNumber})
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
                disabled={!selectedCustomerId || isLoadingLedger}
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
        {summary && customer && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Opening Balance</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(summary.openingBalance)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Total Debit</p>
              <p className="text-xl font-bold text-blue-600">
                {formatCurrency(summary.totalDebit)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Total Credit</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(summary.totalCredit)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Closing Balance</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(summary.closingBalance)}
              </p>
            </div>
          </div>
        )}

        {/* Ledger Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {!selectedCustomerId ? (
            <div className="text-center py-16 text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Select a customer to view their ledger</p>
            </div>
          ) : isLoadingLedger ? (
            <div className="text-center py-16 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading ledger...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No transactions found for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Particulars</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold text-right">
                      Debit
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Credit
                    </TableHead>
                    <TableHead className="font-semibold text-right">
                      Balance
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening Balance Row */}
                  {summary && (
                    <TableRow className="bg-gray-50">
                      <TableCell className="font-medium">
                        {fromDate ? formatDate(fromDate) : "Opening"}
                      </TableCell>
                      <TableCell className="font-medium">
                        Opening Balance
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(summary.openingBalance)}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Ledger Entries */}
                  {entries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm">
                        {formatDate(entry.date)}
                      </TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[entry.type] || entry.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        {Number(entry.debit) > 0
                          ? formatCurrency(Number(entry.debit))
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {Number(entry.credit) > 0
                          ? formatCurrency(Number(entry.credit))
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(entry.runningBalance)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Closing Balance Row */}
                  {summary && (
                    <TableRow className="bg-gray-100 font-semibold">
                      <TableCell>
                        {toDate ? formatDate(toDate) : "Closing"}
                      </TableCell>
                      <TableCell>Closing Balance</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right text-blue-600">
                        {formatCurrency(summary.totalDebit)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(summary.totalCredit)}
                      </TableCell>
                      <TableCell className="text-right">
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
