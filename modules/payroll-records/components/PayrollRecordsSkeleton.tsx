// modules/payroll-records/components/PayrollRecordsSkeleton.tsx
"use client";

import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  type: "employees" | "top-sheet";
}

export function PayrollRecordsSkeleton({ type }: Props) {
  const rows = Array.from({ length: 5 });


  return (
    <>
      {rows.map((_, i) => (
        <TableRow key={i}>
          {type === "employees" ? (
            <>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-48" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-8 w-40 rounded-md" />
              </TableCell>
            </>
          ) : (
            <>
              <TableCell>
                <Skeleton className="h-4 w-48" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="h-4 w-24 ml-auto" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="h-4 w-24 ml-auto" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="h-4 w-24 ml-auto" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="h-4 w-24 ml-auto" />
              </TableCell>
            </>
          )}
        </TableRow>
      ))}
      {type === "top-sheet" && (
        <TableRow className="bg-muted/40">
           <TableCell>
              <Skeleton className="h-4 w-16" />
           </TableCell>
           <TableCell />
           <TableCell className="text-right">
             <Skeleton className="h-4 w-24 ml-auto" />
           </TableCell>
           <TableCell className="text-right">
             <Skeleton className="h-4 w-24 ml-auto" />
           </TableCell>
           <TableCell className="text-right">
             <Skeleton className="h-4 w-24 ml-auto" />
           </TableCell>
           <TableCell className="text-right">
             <Skeleton className="h-4 w-24 ml-auto" />
           </TableCell>
        </TableRow>
      )}
    </>
  );
}
