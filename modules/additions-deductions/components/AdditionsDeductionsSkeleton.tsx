// modules/additions-deductions/components/AdditionsDeductionsSkeleton.tsx
"use client";

import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdditionsDeductionsSkeleton() {
  const rows = Array.from({ length: 5 });

  return (
    <>
      {rows.map((_, i) => (
        <TableRow key={i}>
          <TableCell className="w-[60px]">
            <Skeleton className="h-4 w-4 mx-auto" />
          </TableCell>

          <TableCell className="font-medium">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          </TableCell>

          <TableCell className="w-40">
            <Skeleton className="h-4 w-20" />
          </TableCell>

          <TableCell className="max-w-[260px]">
            <Skeleton className="h-4 w-40" />
          </TableCell>

          <TableCell className="w-[180px]">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-20" />
            </div>
          </TableCell>

          <TableCell className="w-[120px]">
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>

          <TableCell className="text-center w-[120px]">
            <div className="flex items-center justify-center gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
