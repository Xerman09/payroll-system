import React from 'react';
import { 
  Save, 
  RefreshCcw, 
  Search, 
  Clock,
  LayoutGrid
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface WageMatrixHeaderProps {
  lastUpdated: string | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onSave: () => void;
  saving: boolean;
}

export function WageMatrixHeader({
  lastUpdated,
  searchTerm,
  onSearchChange,
  onRefresh,
  onSave,
  saving
}: WageMatrixHeaderProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20 flex-shrink-0">
            <LayoutGrid className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
            Rate & Payout Matrix
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400">
          <span className="text-sm">Manage logistics pricing and payout configurations</span>
          {lastUpdated && (
            <Badge variant="outline" className="text-[10px] font-medium border-slate-200 bg-white/50 backdrop-blur-sm">
              <Clock className="h-3 w-3 mr-1 text-slate-400" />
              Last updated: {lastUpdated}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative group w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <Input 
            placeholder="Search areas..." 
            className="pl-10 w-full sm:w-64 bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500/20 transition-all rounded-xl"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onRefresh} className="flex-1 sm:flex-initial rounded-xl border-slate-300 bg-white/50 backdrop-blur-sm hover:bg-slate-100 transition-all shadow-md">
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button 
              onClick={onSave} 
              disabled={saving}
              className="flex-[2] sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 rounded-xl px-6 gap-2 transition-all active:scale-95"
          >
            {saving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="whitespace-nowrap">Save Matrix</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
