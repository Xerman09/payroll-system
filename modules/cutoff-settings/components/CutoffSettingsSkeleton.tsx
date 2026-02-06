// modules/cutoff-settings/components/CutoffSettingsSkeleton.tsx
"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CutoffSettingsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[1, 2].map((i) => (
        <Card key={i} className="flex flex-col h-full shadow-sm">
          <CardHeader className="pb-3 bg-muted/30">
            <div className="flex justify-between items-start gap-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-4 py-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </CardContent>

          <CardFooter className="pt-3 pb-3 bg-muted/10 border-t min-h-[3rem]">
            <div className="flex items-center gap-2 w-full">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-3 w-20 ml-auto" />
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
