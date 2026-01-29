// modules/payroll-records/components/SortableTableHead.tsx
"use client";

import { ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";

export default function SortableTableHead({
  label,
  sortKey,
  currentSort,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: string;
  currentSort: { key: string; direction: "asc" | "desc" };
  onSort: (key: string) => void;
  className?: string;
}) {
  return (
    <TableHead
      className={`cursor-pointer hover:bg-gray-50 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div
        className={`flex items-center gap-2 ${
          className.includes("text-right") ? "justify-end" : "justify-start"
        }`}
      >
        {label}
        <ArrowUpDown
          size={14}
          className={
            currentSort?.key === sortKey ? "opacity-100" : "opacity-30"
          }
        />
      </div>
    </TableHead>
  );
}
