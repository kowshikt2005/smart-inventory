"use client";

import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";

interface ExportButtonsProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
  disabled?: boolean;
}

export function ExportButtons({ onExportPDF, onExportExcel, disabled }: ExportButtonsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white rounded-md border border-gray-200 shadow-lg z-20">
          <button
            onClick={() => { onExportExcel(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-md"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Export as Excel
          </button>
          <button
            onClick={() => { onExportPDF(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-b-md"
          >
            <FileText className="h-4 w-4 text-red-600" />
            Export as PDF
          </button>
        </div>
      )}
    </div>
  );
}
