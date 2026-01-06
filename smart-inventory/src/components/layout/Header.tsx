"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Menu, Search, Plus, Bell, User } from "lucide-react";

export function Header() {
  return (
    <header className="fixed left-64 right-0 top-0 z-30 border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <button className="rounded-lg p-2 hover:bg-gray-100">
            <Menu className="h-5 w-5 text-gray-600" />
          </button>

          {/* Search Bar */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search..."
              className="pl-9 bg-gray-50 border-gray-200"
            />
          </div>

          {/* Add Button */}
          <Button size="icon" className="bg-green-600 hover:bg-green-700">
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Company Name */}
          <div className="flex flex-col items-end">
            <h2 className="text-sm font-semibold text-gray-900">
              Raga Bakery & Restaurant
            </h2>
            <span className="text-xs text-gray-500">Kerala</span>
          </div>

          {/* Profile Icons */}
          <div className="flex items-center gap-2">
            <button className="rounded-full bg-teal-600 p-2 text-white hover:bg-teal-700">
              <span className="text-xs font-medium">OB</span>
            </button>

            <button className="rounded-full border border-gray-300 p-2 hover:bg-gray-50">
              <User className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
