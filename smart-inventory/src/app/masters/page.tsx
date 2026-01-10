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
import { Plus, Search, Download, Settings } from "lucide-react";

export default function MastersPage() {
  const masterCategories = [
    {
      name: "Customers",
      count: 892,
      icon: "👥",
      description: "Manage customer database with GST details",
    },
    {
      name: "Suppliers",
      count: 156,
      icon: "🏢",
      description: "Supplier information and terms",
    },
    {
      name: "Items/Products",
      count: 1240,
      icon: "📦",
      description: "Product catalog and pricing",
    },
    {
      name: "Rate Sheets",
      count: 45,
      icon: "💰",
      description: "Customer-specific pricing",
    },
    {
      name: "Users & Roles",
      count: 12,
      icon: "👤",
      description: "User management and permissions",
    },
    {
      name: "Bank Accounts",
      count: 5,
      icon: "🏦",
      description: "Company bank account details",
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Breadcrumb */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-blue-600 font-medium">Masters</span>
          </div>
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Master Data Management
          </h1>
          <p className="text-gray-600">
            Manage all your master data including customers, suppliers, items, and more.
          </p>
        </div>

        {/* Master Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {masterCategories.map((category) => (
            <div
              key={category.name}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{category.icon}</div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                  {category.count}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {category.name}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {category.description}
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    if (category.name === 'Customers') {
                      window.location.href = '/masters/customers';
                    } else if (category.name === 'Suppliers') {
                      window.location.href = '/masters/vendors';
                    } else if (category.name === 'Items/Products') {
                      window.location.href = '/masters/items';
                    }
                  }}
                >
                  <Search className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button 
                  size="sm" 
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    if (category.name === 'Customers') {
                      window.location.href = '/masters/customers';
                    } else if (category.name === 'Suppliers') {
                      window.location.href = '/masters/vendors';
                    } else if (category.name === 'Items/Products') {
                      window.location.href = '/masters/items/new';
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add New
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="mt-8 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Master Updates
              </h2>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
                <Button size="sm" variant="outline">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Modified By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    Customer
                  </span>
                </TableCell>
                <TableCell className="font-medium">ABC Industries Ltd</TableCell>
                <TableCell>
                  <span className="text-sm text-gray-600">Created</span>
                </TableCell>
                <TableCell>Admin User</TableCell>
                <TableCell className="text-sm text-gray-500">
                  Today, 2:30 PM
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    Item
                  </span>
                </TableCell>
                <TableCell className="font-medium">Product XYZ-100</TableCell>
                <TableCell>
                  <span className="text-sm text-gray-600">Updated</span>
                </TableCell>
                <TableCell>Manager</TableCell>
                <TableCell className="text-sm text-gray-500">
                  Today, 11:15 AM
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                    Supplier
                  </span>
                </TableCell>
                <TableCell className="font-medium">XYZ Corp</TableCell>
                <TableCell>
                  <span className="text-sm text-gray-600">Created</span>
                </TableCell>
                <TableCell>Admin User</TableCell>
                <TableCell className="text-sm text-gray-500">
                  Yesterday, 4:20 PM
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
