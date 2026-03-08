"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ReorderStatusBadge } from "@/components/reorders/ReorderStatusBadge";
import { VendorSelectionModal } from "@/components/reorders/VendorSelectionModal";
import {
  ArrowLeft, Loader2, PackageCheck, XCircle, X, AlertTriangle,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import useSWR from "swr";

interface ReorderItem {
  id: string;
  itemId: string;
  requiredQty: number;
  rate: number;
  item: {
    id: string;
    itemCode: string;
    name: string;
    unit: string;
    purchasePrice: number;
    brand: {
      id: string;
      name: string;
      preferredVendorId: string | null;
      preferredVendor: { id: string; name: string } | null;
    };
  };
  salesOrders: {
    shortfallQty: number;
    salesOrder: {
      id: string;
      orderNumber: string;
      customer: { name: string };
    };
  }[];
}

interface Reorder {
  id: string;
  reorderNumber: string;
  status: string;
  notes: string | null;
  createdAt: string;
  items: ReorderItem[];
}

interface VendorOption {
  id: string;
  name: string;
  vendorNumber: string;
}

interface VendorGroupRow {
  key: string;
  vendorId: string;
  vendorName: string;
  brandNames: string[];
  items: ReorderItem[];
  checked: boolean;
}

export default function ReorderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: reorder, error, isLoading, mutate } = useSWR<Reorder>(
    id ? `/api/reorders/${id}` : null
  );
  const { data: vendorsData } = useSWR<{ vendors: VendorOption[] }>(
    "/api/vendors?activeOnly=true&limit=500"
  );
  const vendors = vendorsData?.vendors || [];

  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertDate, setConvertDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [convertNotes, setConvertNotes] = useState("");
  const [vendorGroups, setVendorGroups] = useState<VendorGroupRow[]>([]);
  const [vendorModalGroupKey, setVendorModalGroupKey] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<{ createdOrders: { purchaseOrderId: string; orderNumber: string; vendorName: string; itemCount: number }[] } | null>(null);

  const buildVendorGroups = useCallback(() => {
    if (!reorder) return;

    const groupMap = new Map<string, { vendorId: string; vendorName: string; brandNames: Set<string>; items: ReorderItem[] }>();

    for (const item of reorder.items) {
      const brand = item.item.brand;
      const vendorId = brand.preferredVendorId || "";
      const vendorName = brand.preferredVendor?.name || "";
      const key = vendorId || `unassigned-${brand.id}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          vendorId,
          vendorName,
          brandNames: new Set(),
          items: [],
        });
      }
      const group = groupMap.get(key)!;
      group.brandNames.add(brand.name);
      group.items.push(item);
    }

    const groups: VendorGroupRow[] = Array.from(groupMap.entries()).map(
      ([key, g]) => ({
        key,
        vendorId: g.vendorId,
        vendorName: g.vendorName,
        brandNames: Array.from(g.brandNames),
        items: g.items,
        checked: g.vendorId !== "",
      })
    );

    groups.sort((a, b) => (a.vendorId ? 0 : 1) - (b.vendorId ? 0 : 1));

    setVendorGroups(groups);
    setVendorModalGroupKey(null);
  }, [reorder]);

  const handleOpenConvert = () => {
    buildVendorGroups();
    setConvertDate(new Date().toISOString().slice(0, 10));
    setConvertNotes("");
    setConvertResult(null);
    setShowConvertDialog(true);
  };

  const toggleGroupChecked = (key: string) => {
    setVendorGroups((prev) =>
      prev.map((g) => (g.key === key ? { ...g, checked: !g.checked } : g))
    );
  };

  const updateGroupVendor = (key: string, vendorId: string, vendorName: string) => {
    setVendorGroups((prev) =>
      prev.map((g) =>
        g.key === key ? { ...g, vendorId, vendorName } : g
      )
    );
  };

  const vendorModalGroup = vendorGroups.find((g) => g.key === vendorModalGroupKey);

  const checkedGroupCount = vendorGroups.filter(
    (g) => g.checked && g.vendorId
  ).length;

  const totalEstValue = useMemo(() => {
    if (!reorder) return 0;
    return reorder.items.reduce(
      (sum, i) => sum + Number(i.requiredQty) * Number(i.rate),
      0
    );
  }, [reorder]);

  const handleConvert = async () => {
    const validGroups = vendorGroups.filter((g) => g.checked && g.vendorId);
    if (validGroups.length === 0) return;

    setIsConverting(true);
    try {
      const res = await fetch(`/api/reorders/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: convertDate,
          notes: convertNotes || undefined,
          vendorGroups: validGroups.map((g) => ({
            vendorId: g.vendorId,
            itemIds: g.items.map((i) => i.id),
          })),
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        alert(result.error || "Failed to convert");
        return;
      }

      setConvertResult(result);
      mutate();
    } catch {
      alert("Failed to convert reorder");
    } finally {
      setIsConverting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this reorder? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/reorders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Failed to cancel");
        return;
      }
      mutate();
    } catch {
      alert("Failed to cancel");
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !reorder) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <p className="text-red-600">Failed to load reorder.</p>
          <Button variant="outline" onClick={() => router.push("/reports/reorders")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => router.push("/reports/reorders")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{reorder.reorderNumber}</h1>
                <ReorderStatusBadge status={reorder.status} />
              </div>
              <p className="text-sm text-gray-500 mt-1">Created {formatDate(reorder.createdAt)}</p>
            </div>
          </div>
          {reorder.status === "PENDING" && (
            <div className="flex items-center gap-2">
              <Button onClick={handleOpenConvert} className="bg-teal-500 hover:bg-teal-600 text-white">
                <PackageCheck className="h-4 w-4 mr-2" />
                Convert to POs
              </Button>
              <Button variant="outline" onClick={handleCancel} className="text-red-600 hover:text-red-700">
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Reorder
              </Button>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Item Code</TableHead>
                  <TableHead className="font-semibold">Item Name</TableHead>
                  <TableHead className="font-semibold">Brand</TableHead>
                  <TableHead className="font-semibold">Default Vendor</TableHead>
                  <TableHead className="font-semibold text-center">Unit</TableHead>
                  <TableHead className="font-semibold text-right">Req. Qty</TableHead>
                  <TableHead className="font-semibold text-right">Rate</TableHead>
                  <TableHead className="font-semibold text-right">Est. Value</TableHead>
                  <TableHead className="font-semibold">Source SOs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reorder.items.map((ri) => (
                  <TableRow key={ri.id}>
                    <TableCell className="font-mono text-sm">{ri.item.itemCode}</TableCell>
                    <TableCell className="font-medium">{ri.item.name}</TableCell>
                    <TableCell className="text-sm">{ri.item.brand.name}</TableCell>
                    <TableCell>
                      {ri.item.brand.preferredVendor ? (
                        <span className="text-sm">{ri.item.brand.preferredVendor.name}</span>
                      ) : (
                        <span className="text-sm text-amber-600 font-medium">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm">{ri.item.unit}</TableCell>
                    <TableCell className="text-right font-medium">{Number(ri.requiredQty)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(Number(ri.rate))}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(ri.requiredQty) * Number(ri.rate))}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 max-w-[200px]">
                      {ri.salesOrders.map((so) => (
                        <span key={so.salesOrder.id} className="inline-block mr-2">
                          {so.salesOrder.orderNumber} ({Number(so.shortfallQty)} {ri.item.unit})
                        </span>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
            <span className="text-sm text-gray-600 mr-4">Total Estimated Value:</span>
            <span className="font-bold text-gray-900">{formatCurrency(totalEstValue)}</span>
          </div>
        </div>

        {/* Convert Dialog */}
        {showConvertDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl">
              {convertResult ? (
                <div className="p-6">
                  <h2 className="text-xl font-bold text-green-700 mb-4">
                    <PackageCheck className="h-5 w-5 inline mr-2" />
                    Purchase Orders Created
                  </h2>
                  <div className="space-y-2 mb-6">
                    {convertResult.createdOrders.map((po) => (
                      <div key={po.purchaseOrderId} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                        <div>
                          <span className="font-medium text-green-800">{po.orderNumber}</span>
                          <span className="text-green-600 ml-3">{po.vendorName}</span>
                        </div>
                        <span className="text-sm text-green-600">{po.itemCount} item(s)</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowConvertDialog(false)}>Close</Button>
                    <Button className="bg-teal-500 hover:bg-teal-600 text-white" onClick={() => router.push("/purchases/orders")}>
                      View Purchase Orders
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Create Purchase Orders</h2>
                    <Button variant="ghost" size="sm" onClick={() => setShowConvertDialog(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="rounded-lg border border-gray-200 overflow-hidden mb-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-10"></TableHead>
                          <TableHead className="font-semibold">Brand(s)</TableHead>
                          <TableHead className="font-semibold text-center">Items</TableHead>
                          <TableHead className="font-semibold">Vendor</TableHead>
                          <TableHead className="font-semibold text-right">Est. Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendorGroups.map((g) => {
                          const groupValue = g.items.reduce(
                            (s, i) => s + Number(i.requiredQty) * Number(i.rate), 0
                          );

                          return (
                            <TableRow key={g.key} className={!g.vendorId ? "bg-amber-50/50" : ""}>
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={g.checked}
                                  onChange={() => toggleGroupChecked(g.key)}
                                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                />
                              </TableCell>
                              <TableCell className="text-sm">{g.brandNames.join(", ")}</TableCell>
                              <TableCell className="text-center text-sm">{g.items.length}</TableCell>
                              <TableCell>
                                {g.vendorId ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm font-medium">{g.vendorName}</span>
                                    <button
                                      onClick={() => updateGroupVendor(g.key, "", "")}
                                      className="text-gray-400 hover:text-red-500 ml-1"
                                      title="Change vendor"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-sm text-teal-700 border-teal-300 hover:bg-teal-50"
                                      onClick={() => setVendorModalGroupKey(g.key)}
                                    >
                                      Select Vendor
                                    </Button>
                                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" />
                                      No default vendor
                                    </p>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {formatCurrency(groupValue)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">PO Date</label>
                      <Input
                        type="date"
                        value={convertDate}
                        onChange={(e) => setConvertDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                      <Input
                        placeholder="Optional notes for POs..."
                        value={convertNotes}
                        onChange={(e) => setConvertNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      {checkedGroupCount} of {vendorGroups.length} group(s) selected — will create{" "}
                      <strong>{checkedGroupCount}</strong> purchase order(s)
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowConvertDialog(false)}>Cancel</Button>
                      <Button
                        onClick={handleConvert}
                        disabled={checkedGroupCount === 0 || isConverting}
                        className="bg-teal-500 hover:bg-teal-600 text-white"
                      >
                        {isConverting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <PackageCheck className="h-4 w-4 mr-2" />
                        )}
                        Confirm
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vendor Selection Modal */}
        <VendorSelectionModal
          isOpen={!!vendorModalGroupKey}
          onClose={() => setVendorModalGroupKey(null)}
          vendors={vendors}
          brandName={vendorModalGroup?.brandNames.join(", ")}
          onSelect={(vendor) => {
            if (vendorModalGroupKey) {
              updateGroupVendor(vendorModalGroupKey, vendor.id, vendor.name);
              setVendorModalGroupKey(null);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
}
