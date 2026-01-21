"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown, DollarSign, FileText, CreditCard, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

          {/* Date Range Selector */}
          <div className="flex items-center gap-4">
            <Button variant="outline" className="gap-2">
              Select a preset
              <ChevronDown className="h-4 w-4" />
            </Button>

            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />l 
              Jan 01, 2026 - Jan 31, 2026
            </Button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Sales */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2">Total Sales</p>
                <p className="text-3xl font-bold text-gray-900">₹0.00</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Total Purchases */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2">Total Purchases</p>
                <p className="text-3xl font-bold text-gray-900">₹0.00</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Total Expenses */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2">Total Expenses</p>
                <p className="text-3xl font-bold text-gray-900">₹0.00</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <CreditCard className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>

          {/* Net Profit */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-2">Net Profit</p>
                <p className="text-3xl font-bold text-gray-900">₹0.00</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Additional Charts/Widgets can go here */}
        <div className="mt-8">
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <div className="text-center text-gray-500">
              <p className="text-lg font-medium mb-2">No data available</p>
              <p className="text-sm">Start adding transactions to see insights here</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
