"use client";

import { 
  Users, 
  Package, 
  ShoppingCart, 
  FileText, 
  Building2, 
  ClipboardList,
  Search,
  Keyboard,
} from "lucide-react";

export function SearchHelp() {
  const searchTips = [
    {
      icon: Users,
      title: "Customers",
      examples: ["customer name", "phone number", "GSTIN", "city"],
    },
    {
      icon: Building2,
      title: "Vendors",
      examples: ["vendor name", "vendor number", "contact info"],
    },
    {
      icon: Package,
      title: "Items",
      examples: ["item name", "item code", "brand", "HSN code"],
    },
    {
      icon: ShoppingCart,
      title: "Sales Orders",
      examples: ["order number", "customer name", "SO-0001"],
    },
    {
      icon: ClipboardList,
      title: "Stock Journals",
      examples: ["journal number", "SJ-0001", "item name"],
    },
  ];

  const shortcuts = [
    { key: "⌘K", description: "Open search" },
    { key: "↑↓", description: "Navigate results" },
    { key: "Enter", description: "Select result" },
    { key: "Esc", description: "Close search" },
  ];

  return (
    <div className="px-4 py-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Search className="h-4 w-4" />
          What you can search for
        </h3>
        <div className="space-y-3">
          {searchTips.map((tip) => {
            const Icon = tip.icon;
            return (
              <div key={tip.title} className="flex items-start gap-3">
                <Icon className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{tip.title}</p>
                  <p className="text-xs text-gray-500">
                    {tip.examples.join(", ")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Keyboard className="h-4 w-4" />
          Keyboard shortcuts
        </h3>
        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.key} className="flex items-center justify-between">
              <span className="text-xs text-gray-600">{shortcut.description}</span>
              <kbd className="inline-flex items-center px-2 py-1 text-xs font-mono bg-gray-100 text-gray-600 rounded border">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Search across customers, items, orders, and more
        </p>
      </div>
    </div>
  );
}