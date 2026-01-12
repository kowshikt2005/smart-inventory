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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { AddCustomerModal } from "@/components/customers/AddCustomerModal";
import { Plus, MoreHorizontal, Eye, FileText, Loader2, X } from "lucide-react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useDebounce } from "@/hooks/useDebounce";

interface Customer {
  id: string;
  name: string;
  gstin: string;
  city: string;
  state: string;
  creditDays: number;
  creditLimit: number;
  hasPriceList: boolean;
  email?: string | null;
  phone?: string | null;
  stateCode: string;
  addressLine1: string;
  addressLine2?: string | null;
  openingBalance: number;
  openingAsOfDate: Date;
  rateSheet?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function CustomersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const itemsPerPage = 10;

  // Debounce search to avoid excessive filtering
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Use SWR for caching
  const { data, error, isLoading, mutate } = useSWR("/api/customers");
  const customers = data?.customers || [];

  // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    if (!debouncedSearch.trim()) return customers;

    const query = debouncedSearch.toLowerCase();
    return customers.filter(
      (customer: Customer) =>
        customer.name.toLowerCase().includes(query) ||
        customer.gstin.toLowerCase().includes(query) ||
        customer.city.toLowerCase().includes(query) ||
        customer.state.toLowerCase().includes(query)
    );
  }, [debouncedSearch, customers]);

  // Paginate customers
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredCustomers.slice(startIndex, endIndex);
  }, [filteredCustomers, currentPage]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleViewDetails = (customerId: string) => {
    router.push(`/masters/customers/${customerId}`);
  };

  const handleViewTransactions = (customerId: string) => {
    router.push(`/ledger/customers?customerId=${customerId}`);
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            All Customers
          </h1>

          {/* Search and Add Button */}
          <div className="flex items-start justify-between gap-4 mb-6">
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-sm text-gray-600 mt-2">
                  Found {filteredCustomers.length} customer
                  {filteredCustomers.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>
        </div>

        {/* Customers Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <Table aria-label="Customer list">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead scope="col" className="font-semibold">
                  Name
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  GST No.
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  City
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  State
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  Credit Days
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  Credit Limit
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  Price List
                </TableHead>
                <TableHead scope="col" className="font-semibold">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-gray-500 py-12"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading customers...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-red-600 py-8"
                  >
                    <div className="space-y-2">
                      <p>Error: {error.message || "Failed to load customers"}</p>
                      <Button
                        onClick={() => mutate()}
                        variant="outline"
                        size="sm"
                      >
                        Try Again
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedCustomers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-gray-500 py-8"
                  >
                    {searchQuery
                      ? "No customers found matching your search"
                      : "No customers yet. Click 'Add Customer' to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCustomers.map((customer: Customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      {customer.name}
                    </TableCell>
                    <TableCell>{customer.gstin}</TableCell>
                    <TableCell>{customer.city}</TableCell>
                    <TableCell>{customer.state}</TableCell>
                    <TableCell>{customer.creditDays}</TableCell>
                    <TableCell>
                      {customer.creditLimit.toLocaleString('en-US')}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-medium ${
                          customer.hasPriceList
                            ? "text-green-600"
                            : "text-gray-600"
                        }`}
                      >
                        {customer.hasPriceList ? "Yes" : "No"}
                      </span>
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
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleViewDetails(customer.id)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleViewTransactions(customer.id)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Transactions
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredCustomers.length)}{" "}
              of {filteredCustomers.length} customers
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Add Customer Modal */}
        <AddCustomerModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            // Refresh customer list from cache after adding new customer
            mutate();
            setCurrentPage(1); // Reset to first page
          }}
        />
      </div>
    </DashboardLayout>
  );
}
