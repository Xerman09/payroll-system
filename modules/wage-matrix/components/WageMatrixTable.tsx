import React from 'react';
import { Truck, UserCircle, ShieldCheck, AlertCircle, PlusCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LogisticsArea, WageMatrixData, LogisticsStaff, MatrixColumn } from '../types';

interface WageMatrixTableProps {
  mode: string;
  areas: LogisticsArea[];
  data: WageMatrixData | null;
  columns: MatrixColumn[];
  staffByColumn: Record<string, LogisticsStaff | undefined>;
  getVehicleTypeId: (vtName: string | undefined) => number | null;
  getCellValue: (areaId: number, colKey: string) => string;
  handleInputChange: (areaId: number, colKey: string, value: string) => void;
}

export function WageMatrixTable({
  mode,
  areas,
  data,
  columns,
  staffByColumn,
  getVehicleTypeId,
  getCellValue,
  handleInputChange
}: WageMatrixTableProps) {
  
  const matrixMap = React.useMemo(() => {
    if (!data) return {};
    const map: Record<string, string> = {};
    data.matrix.forEach((m) => {
      map[`${m.area_id}_${m.staff_id}_${m.vehicle_type_id}`] = m.wage_amount.toString();
    });
    return map;
  }, [data]);

  const groupSpans = React.useMemo(() => {
    const counts: Record<string, number> = {
      'Fleet Operator': 0,
      'Helper': 0,
      'Logistics Crew': 0
    };
    columns.forEach(col => {
      if (counts[col.group] !== undefined) counts[col.group]++;
    });
    return counts;
  }, [columns]);

  // Count unsaved cells per column for the header badge
  const unsavedCountByCol = React.useMemo(() => {
    const counts: Record<string, number> = {};
    columns.forEach(col => {
      const staff = staffByColumn[col.key];
      if (!staff) { counts[col.key] = 0; return; }
      const vtId = col.vehicleTypeId ?? getVehicleTypeId(col.vehicleType);
      let count = 0;
      areas.forEach(area => {
        const cellValue = getCellValue(area.area_id, col.key);
        if (!cellValue) return;
        const mapKey = `${area.area_id}_${staff.staff_id}_${vtId}`;
        const dbValue = matrixMap[mapKey];
        const isNew     = dbValue === undefined;
        const isChanged = dbValue !== undefined && dbValue !== cellValue;
        if (isNew || isChanged) count++;
      });
      counts[col.key] = count;
    });
    return counts;
  }, [areas, columns, staffByColumn, getVehicleTypeId, getCellValue, matrixMap]);

  // Total unsaved in this section
  const sectionUnsaved = Object.values(unsavedCountByCol).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
       <div className="flex items-center gap-2.5 px-1">
         <div className={`h-6 w-1 rounded-full ${
           mode === 'DELIVERY' ? 'bg-primary' : 
           mode === 'PICKUP ONLY' ? 'bg-emerald-500' : 'bg-purple-500'
         }`} />
         <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
           {mode}
         </h2>
         <Badge variant="secondary" className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-none text-[10px] px-2 py-0 h-5">
           {areas.length} Areas
         </Badge>
         {sectionUnsaved > 0 && (
           <Badge className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-300 dark:border-amber-700/50 text-[10px] font-bold px-2 py-0 h-5 animate-in fade-in duration-300">
             {sectionUnsaved} unsaved
           </Badge>
         )}
       </div>

       <div className="rounded-xl border border-slate-300 dark:border-slate-800/60 shadow-lg overflow-hidden bg-white/60 dark:bg-slate-950/40 backdrop-blur-md">
         <div className="overflow-x-auto">
           <Table>
             <TableHeader>
               {/* Column Groups */}
               <TableRow className="bg-slate-100/80 dark:bg-slate-900/50 border-b-2 border-slate-200 dark:border-slate-800">
                 <TableHead colSpan={2} className="px-3 py-2"></TableHead>
                 {groupSpans['Fleet Operator'] > 0 && (
                   <TableHead colSpan={groupSpans['Fleet Operator']} className="text-center font-bold text-[9px] uppercase tracking-[0.2em] text-primary dark:text-primary border-x border-slate-200/50 dark:border-slate-800/50 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Truck className="h-2.5 w-2.5" />
                        Fleet Operator
                      </div>
                   </TableHead>
                 )}
                 {groupSpans['Helper'] > 0 && (
                   <TableHead colSpan={groupSpans['Helper']} className="text-center font-bold text-[9px] uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 border-x border-slate-100/50 dark:border-slate-800/50 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <UserCircle className="h-2.5 w-2.5" />
                        Helper
                      </div>
                   </TableHead>
                 )}
                 {groupSpans['Logistics Crew'] > 0 && (
                   <TableHead colSpan={groupSpans['Logistics Crew']} className="text-center font-bold text-[9px] uppercase tracking-[0.2em] text-purple-600 dark:text-purple-400 border-l border-slate-100/50 dark:border-slate-800/50 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        Logistics Crew
                      </div>
                   </TableHead>
                 )}
               </TableRow>
               
               {/* Column Headers */}
               <TableRow className="bg-slate-50/50 dark:bg-slate-900/30">
                  <TableHead className="w-[130px] px-2 font-bold text-[10px] text-slate-800 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-950/95 z-10 border-r border-slate-200/50">Areas</TableHead>
                  <TableHead className="w-[50px] text-center font-bold text-[8px] text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 leading-tight p-1">Days</TableHead>
                 
                 {columns.map((col) => {
                   const colUnsaved = unsavedCountByCol[col.key] ?? 0;
                   return (
                  <TableHead key={col.key} className="text-center min-w-[65px] px-1 py-1.5 border-r last:border-r-0 border-slate-200/50 dark:border-slate-800/50">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[9px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-tighter leading-none">
                        {col.label}
                         </span>
                         {colUnsaved > 0 && (
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-bold px-1.5 py-0 border border-amber-300/60 dark:border-amber-700/40 cursor-default">
                                 <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse inline-block" />
                                 {colUnsaved}
                               </span>
                             </TooltipTrigger>
                             <TooltipContent side="top" className="text-[11px]">
                               {colUnsaved} unsaved {colUnsaved === 1 ? 'entry' : 'entries'} in this column
                             </TooltipContent>
                           </Tooltip>
                         )}
                       </div>
                     </TableHead>
                   );
                 })}
               </TableRow>
             </TableHeader>

             <TableBody>
                {areas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2 + columns.length} className="h-32 text-center text-slate-400 italic">
                       No areas found in this category.
                    </TableCell>
                  </TableRow>
                ) : (
                  areas.map((area) => {
                    // Compute row-level unsaved status for row highlight
                    const rowUnsavedCount = columns.reduce((acc, col) => {
                      const staff = staffByColumn[col.key];
                      if (!staff) return acc;
                      const vtId = col.vehicleTypeId ?? getVehicleTypeId(col.vehicleType);
                      const cellValue = getCellValue(area.area_id, col.key);
                      if (!cellValue) return acc;
                      const mapKey = `${area.area_id}_${staff.staff_id}_${vtId}`;
                      const dbValue = matrixMap[mapKey];
                      return (dbValue === undefined || dbValue !== cellValue) ? acc + 1 : acc;
                    }, 0);

                    return (
                      <TableRow key={area.id} className={`group transition-colors border-b border-slate-200/60 dark:border-slate-800/50 ${
                        rowUnsavedCount > 0 ? 'hover:bg-amber-50/30 dark:hover:bg-amber-900/5' : 'hover:bg-primary/5 dark:hover:bg-primary/10'
                      }`}>
                        <TableCell className={`px-2 py-1 font-bold text-[10px] text-slate-950 dark:text-slate-100 sticky left-0 z-10 border-r border-slate-200/30 transition-colors ${
                          rowUnsavedCount > 0
                            ? 'bg-amber-50/80 dark:bg-amber-900/10 group-hover:bg-amber-50 dark:group-hover:bg-amber-900/20'
                            : 'bg-white/95 dark:bg-slate-950/95 group-hover:bg-primary/5 dark:group-hover:bg-primary/10'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <span className="truncate max-w-[100px]">{area.area_name}</span>
                            {rowUnsavedCount > 0 && (
                              <span className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 dark:bg-amber-500 text-white text-[8px] font-black leading-none">
                                {rowUnsavedCount}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-[9px] text-slate-500 border-r border-slate-200 dark:border-slate-800 p-1">
                          {area.max_days || "—"}
                        </TableCell>
                        {columns.map((col) => {
                          const staff = staffByColumn[col.key];
                          const vtId = col.vehicleTypeId ?? getVehicleTypeId(col.vehicleType);
                          const cellValue = getCellValue(area.area_id, col.key);
                          const mapKey = `${area.area_id}_${staff?.staff_id ?? -1}_${vtId}`;
                          const dbValue = matrixMap[mapKey];

                          // Three states: clean, changed (modified existing), new (no DB record yet)
                          const isNew     = !!staff && dbValue === undefined && cellValue !== "";
                          const isChanged = !!staff && dbValue !== undefined && dbValue !== cellValue && cellValue !== "";

                          return (
                            <TableCell key={col.key} className="p-0.5 px-1 border-r last:border-r-0 border-slate-200/40 dark:border-slate-800/30">
                               {!staff ? (
                                 <div className="h-full w-full bg-slate-200/50 dark:bg-slate-800/50 rounded flex items-center justify-center py-2">
                                    <AlertCircle className="h-2.5 w-2.5 text-slate-400" />
                                 </div>
                               ) : (
                                 <Tooltip>
                                   <TooltipTrigger asChild>
                                     <div className="relative">
                                       <Input 
                                          type="number"
                                          value={cellValue}
                                          onChange={(e) => handleInputChange(area.area_id, col.key, e.target.value)}
                                          className={`h-6 text-center font-mono text-[10px] border-none focus:ring-1 rounded-md transition-all px-0.5 ${
                                            isNew
                                              ? 'bg-emerald-50/70 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 focus:ring-emerald-500/50'
                                              : isChanged
                                              ? 'bg-amber-50/70 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 focus:ring-amber-500/50'
                                              : 'bg-transparent text-slate-950 dark:text-slate-100 focus:ring-primary/50'
                                          }`}
                                          placeholder="0.00"
                                        />
                                       {/* Status dot */}
                                       {isNew && (
                                         <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="New — not yet saved" />
                                       )}
                                       {isChanged && (
                                         <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Modified — not yet saved" />
                                       )}
                                     </div>
                                   </TooltipTrigger>
                                   {(isNew || isChanged) && (
                                     <TooltipContent side="top" className="text-[11px] space-y-0.5">
                                       {isNew ? (
                                         <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                           <PlusCircle className="h-3 w-3" /> New entry — not saved
                                         </p>
                                       ) : (
                                         <>
                                           <p className="font-semibold text-amber-600 dark:text-amber-400">Modified — not saved</p>
                                           <p className="text-slate-500">Was: <span className="font-mono">{Number(dbValue).toFixed(2)}</span></p>
                                           <p className="text-slate-500">Now: <span className="font-mono">{Number(cellValue).toFixed(2)}</span></p>
                                         </>
                                       )}
                                     </TooltipContent>
                                   )}
                                 </Tooltip>
                               )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })
                )}
             </TableBody>
           </Table>
         </div>
       </div>
    </div>
  );
}
