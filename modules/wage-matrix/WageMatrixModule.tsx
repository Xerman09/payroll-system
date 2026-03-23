"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  fetchWageMatrixData, 
  upsertWageMatrix,
  patchWageMatrixBulk 
} from './providers/wage-matrixApi';
import { 
  LogisticsArea, 
  LogisticsStaff, 
  SalaryMatrix, 
  WageMatrixData 
} from './types';
import { toast } from "sonner";
import { 
  Save, 
  RefreshCcw, 
  Search, 
  Truck, 
  UserCircle, 
  ShieldCheck, 
  AlertCircle,
  Clock,
  LayoutGrid
} from 'lucide-react';

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Card, 
  CardContent 
} from "@/components/ui/card";

// Mapping Configuration
const COLUMN_MAP = [
  { key: 'driver_below_10w', label: 'Below 10W', group: 'Fleet Operator', role: 'Driver', vehicleType: 'BELOW 10 WHEELER' },
  { key: 'driver_10_wheeler', label: '10 Wheeler', group: 'Fleet Operator', role: 'Driver', vehicleType: '10 WHEELER' },
  { key: 'driver_trailer', label: 'Trailer', group: 'Fleet Operator', role: 'Driver', vehicleType: 'TRAILER' },
  { key: 'helper_extra', label: 'Extra', group: 'Helper', role: 'Helper', employmentType: 'EXTRA' },
  { key: 'helper_probationary', label: 'Probationary', group: 'Helper', role: 'Helper', employmentType: 'PROBATIONARY' },
  { key: 'logistics_regular_lt_10w', label: 'Regular (<10W)', group: 'Logistics Crew', role: 'Helper', employmentType: 'REGULAR(<10W)' },
  { key: 'logistics_regular_10w_t', label: 'Regular (10W/T)', group: 'Logistics Crew', role: 'Helper', employmentType: 'REGULAR(10W/T)' },
];

const LOCAL_STORAGE_KEY = 'wage_matrix_draft_v2';

export default function WageMatrixModule() {
  const [data, setData] = useState<WageMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({}); // Key: areaId_colKey
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWageMatrixData();
      setData(res);
      
      // Initialize draft from matrix data
      const initialDraft: Record<string, string> = {};
      res.matrix.forEach(item => {
        // Find which column this item belongs to
        const staff = res.staff.find(s => s.staff_id === item.staff_id);
        const vt = res.vehicleTypes.find(v => v.vehicle_type_id === item.vehicle_type_id);
        
        const col = COLUMN_MAP.find(c => {
          const matchesStaff = staff?.role === c.role && (c.employmentType ? staff?.employment_type === c.employmentType : true);
          // For drivers, we match vehicle type. For others, we expect 'N/A' or nothing.
          const matchesVT = c.vehicleType ? vt?.vehicle_type === c.vehicleType : (vt?.vehicle_type === 'N/A' || !vt);
          return matchesStaff && matchesVT;
        });

        if (col) {
          const key = `${item.area_id}_${col.key}`;
          initialDraft[key] = item.wage_amount.toString();
        }
      });

      // Merge with localStorage if exists
      const savedDraft = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          Object.assign(initialDraft, parsed);
          toast.info("Unsaved changes restored from cache.");
        } catch (e) {
          console.error("Failed to parse local storage", e);
        }
      }

      setDraft(initialDraft);

      // Check for 'N/A' vehicle type
      const hasNA = res.vehicleTypes.some(vt => vt.vehicle_type === 'N/A');
      if (!hasNA) {
        toast.warning("Vehicle Type 'N/A' is missing. Please add it in Compensation Settings to avoid save errors.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load wage matrix data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (Object.keys(draft).length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(draft));
    }
  }, [draft]);

  const handleInputChange = (areaId: number, colKey: string, value: string) => {
    const key = `${areaId}_${colKey}`;
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const updates: SalaryMatrix[] = [];
      const creates: SalaryMatrix[] = [];
      
      // Construct payload from draft
      Object.entries(draft).forEach(([key, value]) => {
        const [areaIdStr, colKey] = key.split('_');
        const areaId = Number(areaIdStr);
        const amount = parseFloat(value);
        if (isNaN(amount)) return;

        const colConfig = COLUMN_MAP.find(c => c.key === colKey);
        const staff = staffByColumn[colKey];
        if (!staff || !colConfig) return;

        const vtId = getVehicleTypeId(colConfig.vehicleType);

        const existing = data.matrix.find(m => 
          m.area_id === areaId && 
          m.staff_id === staff.staff_id && 
          m.vehicle_type_id === vtId
        );

        const record = {
          area_id: areaId,
          staff_id: staff.staff_id,
          vehicle_type_id: vtId,
          wage_amount: amount
        };

        if (existing?.id) {
          if (existing.wage_amount !== amount) {
            updates.push({ ...record, id: existing.id });
          }
        } else {
          creates.push(record);
        }
      });

      // Execute promises in parallel
      const promises = [];
      if (updates.length > 0) promises.push(patchWageMatrixBulk(updates));
      if (creates.length > 0) promises.push(upsertWageMatrix(creates));
      
      if (promises.length > 0) {
        await Promise.all(promises);
        toast.success(`Matrix saved: ${updates.length} updated, ${creates.length} created.`);
      } else {
        toast.info("No changes to save.");
      }
      
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setLastUpdated(new Date().toLocaleTimeString());
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save wage matrix.");
    } finally {
      setSaving(false);
    }
  };


  const areasByMode = useMemo(() => {
    if (!data) return {};
    const grouped: Record<string, LogisticsArea[]> = {
      'DELIVERY': [],
      'PICKUP ONLY': [],
      'PICKUP W/ MP DELIVERY': []
    };
    data.areas.forEach(area => {
      if (grouped[area.mode_type]) {
        grouped[area.mode_type].push(area);
      }
    });
    return grouped;
  }, [data]);

  const staffByColumn = useMemo(() => {
    if (!data) return {};
    const mapping: Record<string, LogisticsStaff | undefined> = {};
    
    COLUMN_MAP.forEach(col => {
      const found = data.staff.find(s => {
        const matchesRole = s.role === col.role;
        const matchesType = col.employmentType ? s.employment_type === col.employmentType : true;
        
        // For Drivers, we also need to match vehicle type (if applicable)
        // Wait, the DDL says staff has vehicle_type_id.
        // Let's find staff of role Driver. 
        // In the wireframe, "Below 10W", "10 Wheeler", "Trailer" are columns.
        // These are distinct categories. If there's only one "Driver" staff record,
        // then we use that staff_id and vary the vehicle_type_id in the matrix.
        
        // Actually, Staff doesn't necessarily have a 1-to-1 mapping with Vehicle Type here.
        // If Role is Driver, we use those 3 columns.
        // If Role is Helper, we use those 4 columns.
        
        if (col.role === 'Driver') {
           // We just need a representative staff record for 'Driver' role?
           // Or does the project have specific staff records for "Driver Below 10W"?
           // Based on StaffTab, recruitment is by Role & Employment Type.
           // Let's find the FIRST staff record matching the role/employment.
           return matchesRole && matchesType;
        }
        
        return matchesRole && matchesType;
      });
      mapping[col.key] = found;
    });

    return mapping;
  }, [data]);

  const getVehicleTypeId = (vtName: string | undefined): number => {
    if (!data) return 0;
    // If vtName is provided, find that specific type
    if (vtName) {
      const found = data.vehicleTypes.find(vt => vt.vehicle_type === vtName);
      if (found) return found.vehicle_type_id;
    }
    
    // Default to 'N/A' type ID if no specific type is requested or found
    const naType = data.vehicleTypes.find(vt => vt.vehicle_type === 'N/A');
    return naType?.vehicle_type_id || 0;
  };

  const getCellValue = (areaId: number, colKey: string): string => {
    const key = `${areaId}_${colKey}`;
    return draft[key] || "";
  };

  const filteredAreas = (modeType: string) => {
    const areas = areasByMode[modeType] || [];
    if (!searchTerm) return areas;
    return areas.filter(a => a.area_name.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  if (loading && !data) {
    return (
      <DashboardLayout>
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-8 bg-slate-50/30 dark:bg-slate-950/30 min-h-screen">
        {/* Header */}
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
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={loadData} className="flex-1 sm:flex-initial rounded-xl border-slate-300 bg-white/50 backdrop-blur-sm hover:bg-slate-100 transition-all shadow-md">
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="flex-[2] sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 rounded-xl px-6 gap-2 transition-all active:scale-95"
              >
                {saving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="whitespace-nowrap">Save Matrix</span>
              </Button>
            </div>
          </div>
        </div>

        <Separator className="bg-slate-200/60 dark:bg-slate-800/60" />

        {/* Matrix Tables */}
        {Object.keys(areasByMode).map((mode) => {
          const areas = filteredAreas(mode);
          if (areas.length === 0 && searchTerm) return null;

          return (
            <div key={mode} className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center gap-3 px-2">
                 <div className={`h-8 w-1.5 rounded-full ${
                   mode === 'DELIVERY' ? 'bg-blue-500' : 
                   mode === 'PICKUP ONLY' ? 'bg-emerald-500' : 'bg-purple-500'
                 }`} />
                 <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                   {mode}
                 </h2>
                 <Badge variant="secondary" className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border-none">
                   {areas.length} Areas
                 </Badge>
               </div>

               <div className="rounded-2xl border border-slate-300 dark:border-slate-800/60 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-2xl overflow-hidden bg-white/60 dark:bg-slate-950/40 backdrop-blur-md">
                 <div className="overflow-x-auto">
                   <Table>
                     <TableHeader>
                       {/* Column Groups */}
                       <TableRow className="bg-slate-100/80 dark:bg-slate-900/50 border-b-2 border-slate-200 dark:border-slate-800">
                         <TableHead colSpan={2} className="px-6 py-4"></TableHead>
                         <TableHead colSpan={3} className="text-center font-bold text-[10px] uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400 border-x border-slate-200/50 dark:border-slate-800/50 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <Truck className="h-3 w-3" />
                              Fleet Operator
                            </div>
                         </TableHead>
                         <TableHead colSpan={2} className="text-center font-bold text-[10px] uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 border-x border-slate-100/50 dark:border-slate-800/50 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <UserCircle className="h-3 w-3" />
                              Helper
                            </div>
                         </TableHead>
                         <TableHead colSpan={2} className="text-center font-bold text-[10px] uppercase tracking-[0.2em] text-purple-600 dark:text-purple-400 border-l border-slate-100/50 dark:border-slate-800/50 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <ShieldCheck className="h-3 w-3" />
                              Logistics Crew
                            </div>
                         </TableHead>
                       </TableRow>
                       
                       {/* Column Headers */}
                       <TableRow className="bg-slate-50/50 dark:bg-slate-900/30">
                         <TableHead className="w-[220px] px-6 font-bold text-slate-800 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-950/95 z-10 border-r border-slate-200/50">Areas</TableHead>
                         <TableHead className="w-[100px] text-center font-bold text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">Max # Days</TableHead>
                         
                         {COLUMN_MAP.map((col) => (
                           <TableHead key={col.key} className="text-center min-w-[140px] px-4 py-4 border-r last:border-r-0 border-slate-200/50 dark:border-slate-800/50">
                             <div className="flex flex-col items-center gap-0.5">
                               <span className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-tighter">
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
                            <TableCell colSpan={9} className="h-32 text-center text-slate-400 italic">
                               No areas found in this category.
                            </TableCell>
                          </TableRow>
                        ) : (
                          areas.map((area) => (
                            <TableRow key={area.id} className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors border-b border-slate-200/60 dark:border-slate-800/50">
                              <TableCell className="px-6 py-4 font-semibold text-slate-950 dark:text-slate-100 sticky left-0 bg-white/95 dark:bg-slate-950/95 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 z-10 border-r border-slate-200/30">
                                <div className="flex items-center gap-2">
                                  <span className="truncate max-w-[180px]">{area.area_name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs text-slate-600 border-r border-slate-200 dark:border-slate-800">
                                {area.max_days || "—"}
                              </TableCell>
                              {COLUMN_MAP.map((col) => {
                                const staff = staffByColumn[col.key];
                                const vtId = getVehicleTypeId(col.vehicleType);
                                const cellValue = getCellValue(area.area_id, col.key);
                                const isDirty = data?.matrix.find(m => 
                                  m.area_id === area.area_id && 
                                  m.staff_id === (staff?.staff_id || -1) && 
                                  m.vehicle_type_id === vtId
                                )?.wage_amount.toString() !== cellValue && cellValue !== "";

                                return (
                                  <TableCell key={col.key} className="p-1 px-2 border-r last:border-r-0 border-slate-200/40 dark:border-slate-800/30">
                                     {!staff ? (
                                       <div className="h-full w-full bg-slate-200/50 dark:bg-slate-800/50 rounded flex items-center justify-center">
                                          <AlertCircle className="h-3 w-3 text-slate-400" />
                                       </div>
                                     ) : (
                                       <div className="relative">
                                         <Input 
                                           type="number"
                                           value={cellValue}
                                           onChange={(e) => handleInputChange(area.area_id, col.key, e.target.value)}
                                           className={`h-9 text-center font-mono text-sm bg-transparent border-none focus:ring-1 focus:ring-blue-500/50 rounded-lg transition-all text-slate-900 dark:text-slate-100 ${
                                             isDirty ? "bg-amber-100/50 dark:bg-amber-900/10 text-amber-700" : ""
                                           }`}
                                           placeholder="0.00"
                                         />
                                         {isDirty && (
                                           <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
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
        })}

        {/* Empty State when searching */}
        {searchTerm && Object.values(areasByMode).every(arr => arr.filter(a => a.area_name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0) && (
          <Card className="border-dashed border-2 bg-slate-50/50 dark:bg-slate-900/20">
             <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="p-4 bg-slate-200/50 rounded-full">
                  <Search className="h-8 w-8 text-slate-400" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-lg font-semibold text-slate-600">No results found</p>
                  <p className="text-sm text-slate-400">Try adjusting your search term to find areas.</p>
                </div>
                <Button variant="outline" onClick={() => setSearchTerm("")} className="rounded-xl">
                  Clear Search
                </Button>
             </CardContent>
          </Card>
        )}
      </div>

      <style jsx global>{`
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
      `}</style>
    </DashboardLayout>
  );
}
