// modules/coop-management/components/CoopTableSkeleton.tsx
"use client";

import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  type: "savings" | "loans";
}

export function CoopTableSkeleton({ type }: Props) {
  const rows = Array.from({ length: 5 });

  return (
    <>
      {rows.map((_, i) => (
        <TableRow key={i}>
          <TableCell className="w-[50px]">
            <Skeleton className="h-4 w-4 mx-auto" />
          </TableCell>

          {type === "savings" ? (
            <>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-16" />
              </TableCell>
            </>
          ) : (
            <>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
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

          <TableCell className="text-center">
            <Skeleton className="h-5 w-20 rounded-full mx-auto" />
          </TableCell>

          <TableCell className="text-center">
            <div className="flex items-center justify-center gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </TableCell>

          {type === "savings" && (
            <>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
            </>
          )}
        </TableRow>
      ))}
    </>
  );
}
