"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

const ACCOUNT_TYPES = [
  { value: "SAVINGS", label: "Savings" },
  { value: "CURRENT", label: "Current" },
  { value: "OVERDRAFT", label: "Overdraft" },
  { value: "LOAN", label: "Loan" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "CASH", label: "Cash" },
];

interface BankAccount {
  id: string;
  accountName: string;
  accountType: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string | null;
  branch: string | null;
  isDefault: boolean;
}

interface EditBankAccountModalProps {
  open: boolean;
  account: BankAccount | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditBankAccountModal({ open, account, onClose, onSuccess }: EditBankAccountModalProps) {
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("SAVINGS");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branch, setBranch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setAccountName(account.accountName);
      setAccountType(account.accountType);
      setAccountNumber(account.accountNumber);
      setBankName(account.bankName);
      setIfscCode(account.ifscCode || "");
      setBranch(account.branch || "");
      setError(null);
    }
  }, [account]);

  const handleSave = async () => {
    if (!account) return;

    if (!accountName.trim()) {
      setError("Account name is required");
      return;
    }
    if (!accountNumber.trim()) {
      setError("Account number is required");
      return;
    }
    if (!bankName.trim()) {
      setError("Bank name is required");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const response = await fetch(`/api/bank-accounts/${account.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountName: accountName.trim(),
          accountType,
          accountNumber: accountNumber.trim(),
          bankName: bankName.trim(),
          ifscCode: ifscCode.trim() || null,
          branch: branch.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update bank account");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update bank account");
    } finally {
      setIsSaving(false);
    }
  };

  const isCashAccount = account?.accountType === "CASH";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Bank Account</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="editAccountName">Account Name *</Label>
            <Input
              id="editAccountName"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="editAccountType">Account Type *</Label>
            <Select
              value={accountType}
              onValueChange={setAccountType}
              disabled={isCashAccount}
            >
              <SelectTrigger id="editAccountType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isCashAccount && (
              <p className="text-xs text-gray-500 mt-1">Cash account type cannot be changed</p>
            )}
          </div>

          <div>
            <Label htmlFor="editAccountNumber">Account Number *</Label>
            <Input
              id="editAccountNumber"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="editBankName">Bank Name *</Label>
            <Input
              id="editBankName"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="editIfscCode">IFSC Code</Label>
            <Input
              id="editIfscCode"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="editBranch">Branch</Label>
            <Input
              id="editBranch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-teal-500 hover:bg-teal-600"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
