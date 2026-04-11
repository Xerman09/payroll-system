import React from 'react';
import { 
  Save, 
  RefreshCcw, 
  Search, 
  Clock,
  LayoutGrid,
  AlertTriangle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface WageMatrixHeaderProps {
  lastUpdated: string | null;
  searchTerm: string;
  unsavedCount: number;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onSave: () => void;
  saving: boolean;
}

export function WageMatrixHeader({
  lastUpdated,
  searchTerm,
  unsavedCount,
  onSearchChange,
  onRefresh,
  onSave,
  saving
}: WageMatrixHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg shadow-lg shadow-primary/20 flex-shrink-0">
              <LayoutGrid className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
              Rate &amp; Payout Matrix
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400">
            <span className="text-sm">Manage logistics pricing and payout configurations</span>
            {lastUpdated && (
              <Badge variant="outline" className="text-[10px] font-medium border-slate-200 bg-white/50 backdrop-blur-sm">
                <Clock className="h-3 w-3 mr-1 text-slate-400" />
                Last saved: {lastUpdated}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative group w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search areas..." 
              className="pl-10 w-full sm:w-64 bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-primary/20 transition-all rounded-xl"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onRefresh} className="flex-1 sm:flex-initial rounded-xl border-slate-300 bg-white/50 backdrop-blur-sm hover:bg-slate-100 transition-all shadow-md">
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <div className="relative flex-[2] sm:flex-initial">
              <Button 
                onClick={onSave} 
                disabled={saving}
                className={`w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 rounded-xl px-6 gap-2 transition-all active:scale-95 ${
                  unsavedCount > 0 && !saving ? 'ring-2 ring-amber-400 ring-offset-1' : ''
                }`}
              >
                {saving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="whitespace-nowrap">Save Matrix</span>
              </Button>
              {/* Unsaved count badge floated above the Save button */}
              {unsavedCount > 0 && !saving && (
                <span className="absolute -top-2 -right-2 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-amber-400 text-white text-[9px] font-black px-1 shadow-md shadow-amber-400/40 animate-in zoom-in duration-200">
                  {unsavedCount > 99 ? '99+' : unsavedCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unsaved changes banner */}
      {unsavedCount > 0 && !saving && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 animate-in slide-in-from-top-2 duration-300">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            You have <span className="font-bold">{unsavedCount} unsaved {unsavedCount === 1 ? 'change' : 'changes'}</span>. Click <span className="font-semibold">Save Matrix</span> to persist them to the database.
          </p>
        </div>
      )}
    </div>
  );
}
