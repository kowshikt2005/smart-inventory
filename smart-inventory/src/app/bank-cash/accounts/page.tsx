"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddBankAccountModal } from "@/components/bank-accounts/AddBankAccountModal";
import { EditBankAccountModal } from "@/components/bank-accounts/EditBankAccountModal";
import { Loader2, Plus, Pencil, Landmark, Banknote } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

interface BankAccount {
  id: string;
  accountName: string;
  accountType: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string | null;
  branch: string | null;
  openingBalance: number;
  currentBalance: number;
  isDefault: boolean;
  isActive: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TYPE_LABELS: Record<string, string> = {
  CASH: "Cash",
  SAVINGS: "Savings",
  CURRENT: "Current",
  OVERDRAFT: "Overdraft",
  LOAN: "Loan",
  CREDIT_CARD: "Credit Card",
};

const TYPE_COLORS: Record<string, string> = {
  CASH: "bg-green-100 text-green-800",
  SAVINGS: "bg-blue-100 text-blue-800",
  CURRENT: "bg-purple-100 text-purple-800",
  OVERDRAFT: "bg-orange-100 text-orange-800",
  LOAN: "bg-red-100 text-red-800",
  CREDIT_CARD: "bg-yellow-100 text-yellow-800",
};

export default function BankAccountsPage() {
  const { data, isLoading, mutate } = useSWR("/api/bank-accounts", fetcher);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editAccount, setEditAccount] = useState<BankAccount | null>(null);

  const bankAccounts: BankAccount[] = data?.bankAccounts || [];

  const formatCurrency = (amount: number) => {
    const absAmount = Math.abs(amount);
    const formatted = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(absAmount);
    if (amount < 0) return `(${formatted})`;
    return formatted;
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bank & Cash Accounts</h1>
            <p className="text-gray-600">Manage your bank and cash accounts</p>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-teal-500 hover:bg-teal-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="text-center py-16 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading accounts...</p>
            </div>
          ) : bankAccounts.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Landmark className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No bank accounts found</p>
              <p className="text-sm mt-1">Add a bank or cash account to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Account Number</TableHead>
                  <TableHead className="font-semibold">Bank</TableHead>
                  <TableHead className="font-semibold text-right">Balance</TableHead>
                  <TableHead className="font-semibold text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankAccounts.map((account) => (
                  <TableRow key={account.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {account.accountType === "CASH" ? (
                          <Banknote className="h-4 w-4 text-green-600" />
                        ) : (
                          <Landmark className="h-4 w-4 text-blue-600" />
                        )}
                        <span className="font-medium">{account.accountName}</span>
                        {account.isDefault && (
                          <Badge variant="outline" className="text-xs ml-1">Default</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={TYPE_COLORS[account.accountType] || "bg-gray-100 text-gray-800"}>
                        {TYPE_LABELS[account.accountType] || account.accountType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {account.accountNumber}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {account.bankName}
                      {account.branch && <span className="text-gray-400"> - {account.branch}</span>}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${Number(account.currentBalance) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatCurrency(Number(account.currentBalance))}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditAccount(account)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Modals */}
        <AddBankAccountModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            mutate();
          }}
        />
        <EditBankAccountModal
          open={!!editAccount}
          account={editAccount}
          onClose={() => setEditAccount(null)}
          onSuccess={() => {
            setEditAccount(null);
            mutate();
          }}
        />
      </div>
    </DashboardLayout>
  );
}
