"use client";

import { memo } from "react";
import { GlobalSearch } from "@/components/search/GlobalSearch";

export const Header = memo(function Header() {
  return (
    <header className="fixed left-64 right-0 top-0 z-30 border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Global Search */}
          <div className="w-80">
            <GlobalSearch placeholder="Search anything... (⌘K)" />
          </div>
        </div>
      </div>
    </header>
  );
});
