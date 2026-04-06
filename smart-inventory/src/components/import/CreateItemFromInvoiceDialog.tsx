"use client";

import { useState, useEffect } from "react";
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
import { Loader2, PackagePlus, AlertTriangle } from "lucide-react";

interface SubBrand {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
  subBrands: SubBrand[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceType: "SALES" | "PURCHASE";
  invoiceItemId: string;
  itemName: string;
  quantity: number;
  rate?: number;
  taxRate?: number;
  onSuccess: () => void;
}

const UNITS = ["PCS", "KG", "LTR", "MTR", "BOX", "PKT", "SET", "NOS", "BAG", "BTL"];

export function CreateItemFromInvoiceDialog({
  open,
  onOpenChange,
  invoiceType,
  invoiceItemId,
  itemName,
  quantity,
  rate,
  taxRate,
  onSuccess,
}: Props) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: itemName,
    brandId: "",
    subBrandId: "",
    userCode: "",
    hsnCode: "",
    gstRate: "",
    unit: "PCS",
    purchasePrice: "",
    mrp: "",
    sellingPrice: "",
    minStock: "",
  });

  // Reset form when dialog opens — auto-fill from invoice item data
  useEffect(() => {
    if (open) {
      setForm({
        name: itemName,
        brandId: "",
        subBrandId: "",
        userCode: "",
        hsnCode: "",
        gstRate: taxRate != null && taxRate > 0 ? String(taxRate) : "",
        unit: "PCS",
        // rate means purchase price on PURCHASE invoices, selling price on SALES
        purchasePrice: invoiceType === "PURCHASE" && rate != null && rate > 0 ? String(rate) : "",
        mrp: "",
        sellingPrice: invoiceType === "SALES" && rate != null && rate > 0 ? String(rate) : "",
        minStock: "",
      });
      setApiError(null);
    }
  }, [open, itemName, rate, taxRate, invoiceType]);

  // Fetch brands + sub-brands once when dialog opens
  useEffect(() => {
    if (!open) return;
    setBrandsLoading(true);
    fetch("/api/brands?includeSubBrands=true&limit=1000")
      .then((r) => r.json())
      .then((data) => setBrands(data.brands || []))
      .catch(() => setBrands([]))
      .finally(() => setBrandsLoading(false));
  }, [open]);

  const selectedBrand = brands.find((b) => b.id === form.brandId);
  const subBrands = selectedBrand?.subBrands ?? [];

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Reset sub-brand when brand changes
      if (field === "brandId") next.subBrandId = "";
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.brandId || !form.subBrandId) {
      setApiError("Brand and Sub-Brand are required.");
      return;
    }
    setSaving(true);
    setApiError(null);
    try {
      const res = await fetch("/api/import/resolve-invoice-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceItemId,
          invoiceType,
          itemData: {
            name: form.name.trim(),
            brandId: form.brandId,
            subBrandId: form.subBrandId,
            userCode: form.userCode.trim() || null,
            hsnCode: form.hsnCode.trim() || null,
            gstRate: form.gstRate ? parseFloat(form.gstRate) : 0,
            unit: form.unit,
            purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : 0,
            mrp: form.mrp ? parseFloat(form.mrp) : 0,
            sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice) : 0,
            minStock: form.minStock ? parseFloat(form.minStock) : 0,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create item");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-teal-600" />
            Create Item in Masters
          </DialogTitle>
        </DialogHeader>

        {/* Context banner */}
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium">&ldquo;{itemName}&rdquo;</span> was not found in masters.
            Fill in the details below to create it. Stock will be{" "}
            <span className="font-medium">
              {invoiceType === "SALES" ? "decremented" : "incremented"} by {quantity}
            </span>{" "}
            units once saved.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          {/* Item Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Item Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          {/* Brand + Sub-Brand */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Brand <span className="text-red-500">*</span>
              </Label>
              {brandsLoading ? (
                <div className="flex items-center gap-2 h-9 text-sm text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </div>
              ) : (
                <Select value={form.brandId} onValueChange={(v) => set("brandId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Sub-Brand <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.subBrandId}
                onValueChange={(v) => set("subBrandId", v)}
                disabled={!form.brandId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.brandId ? "Select sub-brand" : "Select brand first"} />
                </SelectTrigger>
                <SelectContent>
                  {subBrands.map((sb) => (
                    <SelectItem key={sb.id} value={sb.id}>
                      {sb.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* User Code + HSN */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="userCode">User Code</Label>
              <Input
                id="userCode"
                placeholder="Optional"
                value={form.userCode}
                onChange={(e) => set("userCode", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hsnCode">HSN Code</Label>
              <Input
                id="hsnCode"
                placeholder="Optional"
                value={form.hsnCode}
                onChange={(e) => set("hsnCode", e.target.value)}
              />
            </div>
          </div>

          {/* GST Rate + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gstRate">GST Rate (%)</Label>
              <Input
                id="gstRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                value={form.gstRate}
                onChange={(e) => set("gstRate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="purchasePrice">Purchase Price</Label>
              <Input
                id="purchasePrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.purchasePrice}
                onChange={(e) => set("purchasePrice", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mrp">MRP</Label>
              <Input
                id="mrp"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.mrp}
                onChange={(e) => set("mrp", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sellingPrice">Selling Price</Label>
              <Input
                id="sellingPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.sellingPrice}
                onChange={(e) => set("sellingPrice", e.target.value)}
              />
            </div>
          </div>

          {/* Min Stock */}
          <div className="space-y-1.5">
            <Label htmlFor="minStock">Min Stock Level</Label>
            <Input
              id="minStock"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={form.minStock}
              onChange={(e) => set("minStock", e.target.value)}
            />
          </div>

          {apiError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {apiError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <PackagePlus className="h-4 w-4 mr-1.5" />
                  Create &amp; Link Item
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
