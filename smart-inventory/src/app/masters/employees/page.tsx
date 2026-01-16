"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  X,
  Users,
  Search,
} from "lucide-react";
import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useDebounce } from "@/hooks/useDebounce";
import { AddEmployeeModal } from "@/components/employees/AddEmployeeModal";
import { EditEmployeeModal } from "@/components/employees/EditEmployeeModal";

interface Employee {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  department?: string;
  salary?: number;
  joinDate: string;
  role?: string;
  isActive: boolean;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-800",
  MANAGER: "bg-purple-100 text-purple-800",
  ACCOUNTANT: "bg-blue-100 text-blue-800",
  BILLING_OPERATOR: "bg-green-100 text-green-800",
  SALESMAN: "bg-gray-100 text-gray-800",
};

export default function EmployeesPage() {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const itemsPerPage = 10;

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Check if user is admin
  const isAdmin = session?.user?.role === 'ADMIN';

  const { data, error, isLoading, mutate } = useSWR(
    isAdmin ? `/api/employees?page=${currentPage}&limit=${itemsPerPage}&search=${encodeURIComponent(debouncedSearch)}` : null
  );

  const employees: Employee[] = data?.employees || [];
  const totalCount = data?.pagination?.total || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/employees/${deleteId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        mutate();
        setDeleteId(null);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete employee");
      }
    } catch (err) {
      console.error("Error deleting employee:", err);
      alert("Failed to delete employee");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-red-400" />
            <h2 className="text-lg font-semibold text-red-900 mb-2">Access Denied</h2>
            <p className="text-red-700">You need administrator privileges to access employee management.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Employee Management</h1>
          <p className="text-gray-600">Manage employee accounts and permissions</p>
        </div>

        {/* Search and Add Button */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 pr-8"
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-sm text-gray-600 mt-2">
                Found {totalCount} employee{totalCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Button
            className="bg-teal-500 hover:bg-teal-600 text-white"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </div>

        {/* Employees Table */}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Employee #</TableHead>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Role</TableHead>
                <TableHead className="font-semibold">Designation</TableHead>
                <TableHead className="font-semibold">Department</TableHead>
                <TableHead className="font-semibold">Salary</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading employees...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-red-600 py-8">
                    <p>Error loading employees</p>
                    <Button onClick={() => mutate()} variant="outline" size="sm" className="mt-2">
                      Try Again
                    </Button>
                  </TableCell>
                </TableRow>
              ) : employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-500 py-12">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>
                      {searchQuery
                        ? "No employees found matching your search"
                        : "No employees yet. Click 'Add Employee' to create one."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((employee) => (
                  <TableRow key={employee.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono font-medium">
                      {employee.employeeNumber}
                    </TableCell>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell className="text-sm text-gray-600">{employee.email}</TableCell>
                    <TableCell>
                      <Badge className={ROLE_COLORS[employee.role || 'SALESMAN']}>
                        {employee.role?.replace('_', ' ') || 'SALESMAN'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{employee.designation || "-"}</TableCell>
                    <TableCell className="text-sm">{employee.department || "-"}</TableCell>
                    <TableCell className="text-sm">
                      {employee.salary ? formatCurrency(employee.salary) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.isActive ? "default" : "secondary"}>
                        {employee.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(employee)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Employee
                          </DropdownMenuItem>
                          {employee.email !== session?.user?.email && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteId(employee.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Employee
                              </DropdownMenuItem>
                            </>
                          )}
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
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} employees
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Add Employee Modal */}
        <AddEmployeeModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            mutate();
            setCurrentPage(1);
          }}
        />

        {/* Edit Employee Modal */}
        <EditEmployeeModal
          isOpen={!!editingEmployee}
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSuccess={() => {
            mutate();
          }}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Employee?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the employee account and all associated data.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? "Deleting..." : "Delete Employee"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}