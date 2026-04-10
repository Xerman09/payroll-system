import React from 'react';
import { Truck, UserCircle, ShieldCheck, AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

  return (
    <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
       <div className="flex items-center gap-2.5 px-1">
         <div className={`h-6 w-1 rounded-full ${
           mode === 'DELIVERY' ? 'bg-blue-500' : 
           mode === 'PICKUP ONLY' ? 'bg-emerald-500' : 'bg-purple-500'
         }`} />
         <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
           {mode}
         </h2>
         <Badge variant="secondary" className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-none text-[10px] px-2 py-0 h-5">
           {areas.length} Areas
         </Badge>
       </div>

       <div className="rounded-xl border border-slate-300 dark:border-slate-800/60 shadow-lg overflow-hidden bg-white/60 dark:bg-slate-950/40 backdrop-blur-md">
         <div className="overflow-x-auto">
           <Table>
             <TableHeader>
               {/* Column Groups */}
               <TableRow className="bg-slate-100/80 dark:bg-slate-900/50 border-b-2 border-slate-200 dark:border-slate-800">
                 <TableHead colSpan={2} className="px-3 py-2"></TableHead>
                 {groupSpans['Fleet Operator'] > 0 && (
                   <TableHead colSpan={groupSpans['Fleet Operator']} className="text-center font-bold text-[9px] uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400 border-x border-slate-200/50 dark:border-slate-800/50 py-2">
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
                 <TableHead className="w-[160px] px-3 font-semibold text-[11px] text-slate-800 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-950/95 z-10 border-r border-slate-200/50">Areas</TableHead>
                 <TableHead className="w-[70px] text-center font-semibold text-[9px] text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 leading-tight">Max # Days</TableHead>
                 
                 {columns.map((col) => (
                   <TableHead key={col.key} className="text-center min-w-[90px] px-2 py-2.5 border-r last:border-r-0 border-slate-200/50 dark:border-slate-800/50">
                     <div className="flex flex-col items-center gap-0.5">
                       <span className="text-[10px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-tighter leading-none">
                         {col.label}
                       </span>
                     </div>
                   </TableHead>
                 ))}
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
                  areas.map((area) => (
                    <TableRow key={area.id} className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors border-b border-slate-200/60 dark:border-slate-800/50">
                      <TableCell className="px-3 py-1.5 font-medium text-[11px] text-slate-950 dark:text-slate-100 sticky left-0 bg-white/95 dark:bg-slate-950/95 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 z-10 border-r border-slate-200/30">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[140px]">{area.area_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-[10px] text-slate-600 border-r border-slate-200 dark:border-slate-800">
                        {area.max_days || "—"}
                      </TableCell>
                      {columns.map((col) => {
                        const staff = staffByColumn[col.key];
                        const vtId = col.vehicleTypeId ?? getVehicleTypeId(col.vehicleType);
                        const cellValue = getCellValue(area.area_id, col.key);
                        const mapKey = `${area.area_id}_${staff?.staff_id ?? -1}_${vtId}`;
                        const dbValue = matrixMap[mapKey];
                        const isDirty = dbValue !== undefined && dbValue !== cellValue && cellValue !== "";

                        return (
                          <TableCell key={col.key} className="p-0.5 px-1 border-r last:border-r-0 border-slate-200/40 dark:border-slate-800/30">
                             {!staff ? (
                               <div className="h-full w-full bg-slate-200/50 dark:bg-slate-800/50 rounded flex items-center justify-center py-2">
                                  <AlertCircle className="h-2.5 w-2.5 text-slate-400" />
                               </div>
                             ) : (
                               <div className="relative">
                                 <Input 
                                   type="number"
                                   value={cellValue}
                                   onChange={(e) => handleInputChange(area.area_id, col.key, e.target.value)}
                                   className={`h-7 text-center font-mono text-[10px] bg-transparent border-none focus:ring-1 focus:ring-blue-500/50 rounded-md transition-all text-slate-900 dark:text-slate-100 px-1 ${
                                     isDirty ? "bg-amber-100/50 dark:bg-amber-900/10 text-amber-700" : ""
                                   }`}
                                   placeholder="0.00"
                                 />
                                 {isDirty && (
                                   <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                                 )}
                               </div>
                             )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
             </TableBody>
           </Table>
         </div>
       </div>
    </div>
  );
}
