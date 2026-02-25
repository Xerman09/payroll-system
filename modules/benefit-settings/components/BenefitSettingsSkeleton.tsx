// modules/benefit-settings/components/BenefitSettingsSkeleton.tsx
"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

/** Skeletons for the triple cards at the top */
export function BenefitCardSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-800/50 p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-md" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1 rounded-md" />
              <Skeleton className="h-9 flex-1 rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-gray-800">
            <div className="flex items-center justify-between text-[10px]">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/** Skeletons for the tables (Loans / Logs) */
export function BenefitTableSkeleton({ columns = 8 }: { columns?: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: columns }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full max-w-[120px]" />
              {j === 0 && <Skeleton className="h-3 w-20 mt-1" />}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
