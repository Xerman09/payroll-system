// modules/calendar-management/components/CalendarManagementSkeleton.tsx
"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export function CalendarManagementSkeleton() {
  return (
    <div className="flex flex-col gap-6 h-full p-6 bg-gray-50 dark:bg-gray-950 font-sans">
      {/* HEADER */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Separator />

      {/* --- TOP ROW --- */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[500px]">
        {/* 1. CALENDAR VIEW SKELETON */}
        <div className="xl:col-span-3 flex flex-col h-full overflow-hidden">
          <div className="h-full border dark:border-gray-700 rounded-lg shadow-sm flex flex-col overflow-hidden bg-white dark:bg-gray-900">
            <div className="py-3 px-5 border-b dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="flex-1 flex flex-col p-6 space-y-6">
              {/* Calendar Header */}
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <div className="flex gap-1">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </div>

              {/* Grid Skeleton */}
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-8 mx-auto" />
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-2 gap-x-1 justify-items-center">
                  {Array.from({ length: 31 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-10 rounded-full" />
                  ))}
                </div>
              </div>

              {/* Selected Date Info */}
              <div className="mt-auto pt-6">
                <div className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. EVENTS TABLE SKELETON */}
        <div className="xl:col-span-9 flex flex-col h-full overflow-hidden">
          <div className="flex-1 flex flex-col border dark:border-gray-700 rounded-lg shadow-sm overflow-hidden bg-white dark:bg-gray-900">
            {/* Top Bar */}
            <div className="px-5 py-3 border-b dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-900">
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-64 rounded-md" />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 divide-x dark:divide-gray-700 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  <Skeleton className="w-8 h-8 rounded-full" />
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <th key={i} className="px-5 py-3">
                        <Skeleton className="h-3 w-16" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b dark:border-gray-800">
                      <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-3 py-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-3 py-4"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-3 py-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-6 rounded-full" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </td>
                      <td className="px-5 py-4"><div className="flex justify-end gap-2"><Skeleton className="h-7 w-7 rounded" /><Skeleton className="h-7 w-7 rounded" /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="border-t dark:border-gray-700 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-7 rounded" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
