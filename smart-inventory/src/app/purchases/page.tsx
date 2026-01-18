"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ShoppingCart,
  FileText,
  CreditCard,
  RotateCcw,
  TrendingUp,
  Calendar,
  DollarSign,
  Package,
} from "lucide-react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

interface StatsData {
  orders: {
    total: number;
    open: number;
    partial: number;
    received: number;
  };
  invoices: {
    total: number;
    pending: number;
    paid: number;
    overdue: number;
  };
  payments: {
    total: number;
    amount: number;
  };
  returns: {
    total: number;
    open: number;
    completed: number;
  };
}

export default function PurchasesDashboardPage() {
  const router = useRouter();
  
  // Fetch stats from all purchase modules
  const { data: stats, error, isLoading } = useSWR<StatsData>("/api/purchases/stats");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const quickActions = [
    {
      title: "New Purchase Order",
      description: "Create a new purchase order",
      icon: ShoppingCart,
      href: "/purchases/orders/new",
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      title: "New Purchase Invoice",
      description: "Create invoice from order or standalone",
      icon: FileText,
      href: "/purchases/invoices/new",
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      title: "Record Payment",
      description: "Record payment to vendor",
      icon: CreditCard,
      href: "/purchases/payments/new",
      color: "bg-purple-500 hover:bg-purple-600",
    },
    {
      title: "Process Return",
      description: "Create purchase return",
      icon: RotateCcw,
      href: "/purchases/returns/new",
      color: "bg-orange-500 hover:bg-orange-600",
    },
  ];

  const modules = [
    {
      title: "Purchase Orders",
      icon: ShoppingCart,
      href: "/purchases/orders",
      description: "Manage vendor purchase orders",
      stats: [
        { label: "Total", value: stats?.orders.total || 0, color: "text-blue-600" },
        { label: "Open", value: stats?.orders.open || 0, color: "text-yellow-600" },
        { label: "Received", value: stats?.orders.received || 0, color: "text-green-600" },
      ],
    },
    {
      title: "Purchase Invoices",
      icon: FileText,
      href: "/purchases/invoices",
      description: "Track vendor invoices",
      stats: [
        { label: "Total", value: stats?.invoices.total || 0, color: "text-blue-600" },
        { label: "Pending", value: stats?.invoices.pending || 0, color: "text-yellow-600" },
        { label: "Paid", value: stats?.invoices.paid || 0, color: "text-green-600" },
      ],
    },
    {
      title: "Vendor Payments",
      icon: CreditCard,
      href: "/purchases/payments",
      description: "Manage payments to vendors",
      stats: [
        { label: "Total", value: stats?.payments.total || 0, color: "text-blue-600" },
        { label: "Amount", value: formatCurrency(stats?.payments.amount || 0), color: "text-green-600" },
      ],
    },
    {
      title: "Purchase Returns",
      icon: RotateCcw,
      href: "/purchases/returns",
      description: "Handle purchase returns",
      stats: [
        { label: "Total", value: stats?.returns.total || 0, color: "text-blue-600" },
        { label: "Open", value: stats?.returns.open || 0, color: "text-yellow-600" },
        { label: "Completed", value: stats?.returns.completed || 0, color: "text-green-600" },
      ],
    },
  ];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading purchase dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Purchase Management</h1>
          <p className="text-gray-600">
            Manage your complete procurement lifecycle from orders to payments
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Button
                key={action.title}
                onClick={() => router.push(action.href)}
                className={`${action.color} text-white h-20 flex flex-col items-center justify-center gap-2`}
              >
                <action.icon className="h-6 w-6" />
                <div className="text-center">
                  <p className="font-medium text-sm">{action.title}</p>
                  <p className="text-xs opacity-90">{action.description}</p>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Modules Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Purchase Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {modules.map((module) => (
              <Card 
                key={module.title} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(module.href)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-100 rounded-lg">
                      <module.icon className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{module.title}</CardTitle>
                      <CardDescription className="text-sm">
                        {module.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {module.stats.map((stat, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-600">{stat.label}:</span>
                        <span className={`font-medium ${stat.color}`}>
                          {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Workflow Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-600" />
              Purchase Workflow
            </CardTitle>
            <CardDescription>
              Follow this standard workflow for efficient procurement management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <ShoppingCart className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-medium text-sm mb-1">1. Create Order</h3>
                <p className="text-xs text-gray-600">Place purchase order with vendor</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Package className="h-6 w-6 text-yellow-600" />
                </div>
                <h3 className="font-medium text-sm mb-1">2. Receive Goods</h3>
                <p className="text-xs text-gray-600">Mark order as received/partial</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-medium text-sm mb-1">3. Create Invoice</h3>
                <p className="text-xs text-gray-600">Generate purchase invoice</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CreditCard className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-medium text-sm mb-1">4. Make Payment</h3>
                <p className="text-xs text-gray-600">Record payment to vendor</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}