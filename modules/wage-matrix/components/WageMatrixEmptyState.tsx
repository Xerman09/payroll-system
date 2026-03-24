import React from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface WageMatrixEmptyStateProps {
  onClearSearch: () => void;
}

export function WageMatrixEmptyState({ onClearSearch }: WageMatrixEmptyStateProps) {
  return (
    <Card className="border-dashed border-2 bg-slate-50/50 dark:bg-slate-900/20">
       <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="p-4 bg-slate-200/50 rounded-full">
            <Search className="h-8 w-8 text-slate-400" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-lg font-semibold text-slate-600">No results found</p>
            <p className="text-sm text-slate-400">Try adjusting your search term to find areas.</p>
          </div>
          <Button variant="outline" onClick={onClearSearch} className="rounded-xl">
            Clear Search
          </Button>
       </CardContent>
    </Card>
  );
}
