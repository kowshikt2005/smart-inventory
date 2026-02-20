"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AddCustomerModal } from "@/components/customers/AddCustomerModal";
import {
  Plus,
  MoreHorizontal,
  Eye,
  FileText,
  Loader2,
  X,
  PowerOff,
  Power,
} from "lucide-react";
import { ImportButton } from "@/components/import/ImportButton";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useDebounce } from "@/hooks/useDebounce";

interface Customer {
  id: string;
  name: string;
  gstin: string | null;
  city: string | null;
  state: string | null;
  creditDays: number;
  creditLimit: number;
  email?: string | null;
  phone?: string | null;
  openingBalance: number;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export default function CustomersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const itemsPerPage = 10;

  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data, error, isLoading, mutate } = useSWR("/api/customers?limit=1000");

  const filteredCustomers = useMemo(() => {
    const customers: Customer[] = data?.customers || [];
    return customers.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (!debouncedSearch.trim()) return true;
      const q = debouncedSearch.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.gstin ?? "").toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q) ||
        (c.state ?? "").toLowerCase().includes(q)
      );
    });
  }, [debouncedSearch, data, statusFilter]);

  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(start, start + itemsPerPage);
  }, [filteredCustomers, currentPage]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (f: StatusFilter) => {
    setStatusFilter(f);
    setCurrentPage(1);
  };

  const handleToggleStatus = async (customer: Customer) => {
    setTogglingId(customer.id);
    const newStatus = customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      mutate();
    } catch {
      alert("Failed to update customer status. Please try again.");
    } finally {
      setTogglingId(null);
    }
  };

  const counts = useMemo(() => {
    const all: Customer[] = data?.customers || [];
    return {
      all: all.length,
      active: all.filter((c) => c.status === "ACTIVE").length,
      inactive: all.filter((c) => c.status === "INACTIVE").length,
    };
  }, [data]);

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">All Customers</h1>

          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pr-8"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearchChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-sm text-muted-foreground mt-2">
                  Found {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ImportButton entityType="CUSTOMER" entityLabel="Customers" onSuccess={() => mutate()} />
              <Button
                onClick={() => setShowAddModal(true)}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </div>
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1 border-b border-border mb-0">
            {(["ALL", "ACTIVE", "INACTIVE"] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => handleStatusFilterChange(f)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  statusFilter === f
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "ALL" ? "All" : f === "ACTIVE" ? "Active" : "Inactive"}
                <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                  {f === "ALL" ? counts.all : f === "ACTIVE" ? counts.active : counts.inactive}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-white shadow-sm overflow-hidden">
          <Table aria-label="Customer list">
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">GST No.</TableHead>
                <TableHead className="font-semibold">State Code</TableHead>
                <TableHead className="font-semibold">PAN</TableHead>
                <TableHead className="font-semibold">City</TableHead>
                <TableHead className="font-semibold">State</TableHead>
                <TableHead className="font-semibold">Credit Days</TableHead>
                <TableHead className="font-semibold">Credit Limit</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading customers...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-red-600 py-8">
                    <div className="space-y-2">
                      <p>Error: {error.message || "Failed to load customers"}</p>
                      <Button onClick={() => mutate()} variant="outline" size="sm">Try Again</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    {searchQuery ? "No customers found matching your search" : "No customers yet."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCustomers.map((customer) => {
                  const inactive = customer.status === "INACTIVE";
                  return (
                    <TableRow
                      key={customer.id}
                      className={inactive ? "opacity-50 bg-muted/20" : undefined}
                    >
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell className="font-mono text-sm">{customer.gstin || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {customer.gstin && customer.gstin.length >= 2 ? customer.gstin.substring(0, 2) : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {customer.gstin && customer.gstin.length >= 12 ? customer.gstin.substring(2, 12) : "-"}
                      </TableCell>
                      <TableCell>{customer.city || "-"}</TableCell>
                      <TableCell>{customer.state || "-"}</TableCell>
                      <TableCell>{customer.creditDays}</TableCell>
                      <TableCell>{Number(customer.creditLimit).toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        <Badge variant={inactive ? "secondary" : "default"} className={inactive ? "" : "bg-green-100 text-green-700 border-green-200"}>
                          {inactive ? "Inactive" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label={`Actions for ${customer.name}`}
                            >
                              {togglingId === customer.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/masters/customers/${customer.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/ledger/customers?customerId=${customer.id}`)}>
                              <FileText className="h-4 w-4 mr-2" />
                              View Transactions
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(customer)}
                              className={inactive ? "text-green-600" : "text-orange-600"}
                            >
                              {inactive ? (
                                <><Power className="h-4 w-4 mr-2" />Activate</>
                              ) : (
                                <><PowerOff className="h-4 w-4 mr-2" />Deactivate</>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} of{" "}
              {filteredCustomers.length} customers
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                Next
              </Button>
            </div>
          </div>
        )}

        <AddCustomerModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { mutate(); setCurrentPage(1); }}
        />
      </div>
    </DashboardLayout>
  );
}
