"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  fetchWageMatrixData, 
  upsertWageMatrix, 
  patchWageMatrixBulk 
} from "./providers/wage-matrixApi";
import { 
  WageMatrixData, 
  SalaryMatrix, 
  LogisticsStaff,
  MatrixColumn,
  LogisticsArea
} from "./types";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { getDraft, saveDraft, clearDraft } from '@/lib/wageMatrixCache';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WageMatrixHeader } from './components/WageMatrixHeader';
import { WageMatrixTable } from './components/WageMatrixTable';
import { WageMatrixEmptyState } from './components/WageMatrixEmptyState';

export default function WageMatrixModule() {
  const [data, setData] = useState<WageMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({}); // Key: areaId_colKey
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const columns: MatrixColumn[] = useMemo(() => {
    if (!data) return [];
    
    const driverCols = data.vehicleTypes
      .filter(vt => !!vt.is_payroll)
      .map(vt => ({
        key: `driver_${vt.id}`,
        label: vt.type_name,
        group: 'Fleet Operator',
        role: 'Driver' as const,
        vehicleType: vt.type_name,
        vehicleTypeId: vt.id
      }));

    const helperCols = [
      { key: 'helper_extra', label: 'Extra', group: 'Helper', role: 'Helper' as const, employmentType: 'EXTRA' },
      { key: 'helper_probationary', label: 'Probationary', group: 'Helper', role: 'Helper' as const, employmentType: 'PROBATIONARY' },
    ];

    const crewCols = [
      { key: 'logistics_regular_lt_10w', label: 'Regular (<10W)', group: 'Logistics Crew', role: 'Helper' as const, employmentType: 'REGULAR(<10W)' },
      { key: 'logistics_regular_10w_t', label: 'Regular (10W/T)', group: 'Logistics Crew', role: 'Helper' as const, employmentType: 'REGULAR(10W/T)' },
    ];

    return [...driverCols, ...helperCols, ...crewCols];
  }, [data]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWageMatrixData();
      setData(res);

      // Build columns locally from res to avoid the stale closure problem
      // (the `columns` useMemo won't have updated yet when this runs)
      const localDriverCols = res.vehicleTypes
        .filter(vt => !!vt.is_payroll)
        .map(vt => ({
          key: `driver_${vt.id}`,
          role: 'Driver' as const,
          vehicleTypeId: vt.id,
          employmentType: undefined as string | undefined,
        }));

      const localHelperCols = [
        { key: 'helper_extra',        role: 'Helper' as const, vehicleTypeId: undefined as number | undefined, employmentType: 'EXTRA'              },
        { key: 'helper_probationary', role: 'Helper' as const, vehicleTypeId: undefined as number | undefined, employmentType: 'PROBATIONARY'       },
      ];

      const localCrewCols = [
        { key: 'logistics_regular_lt_10w', role: 'Helper' as const, vehicleTypeId: undefined as number | undefined, employmentType: 'REGULAR(<10W)'  },
        { key: 'logistics_regular_10w_t',  role: 'Helper' as const, vehicleTypeId: undefined as number | undefined, employmentType: 'REGULAR(10W/T)' },
      ];

      const localCols = [...localDriverCols, ...localHelperCols, ...localCrewCols];

      // Initialize draft from matrix data using the local columns
      const initialDraft: Record<string, string> = {};
      res.matrix.forEach(item => {
        const staff = res.staff.find(s => s.staff_id === item.staff_id);
        if (!staff) return;

        const col = localCols.find(c => {
          if (staff.role !== c.role) return false;

          if (c.role === 'Driver') {
            // Driver columns are keyed by vehicle_type_id in the matrix row
            return c.vehicleTypeId === item.vehicle_type_id;
          }

          // Helper / Logistics Crew: match employment_type + null vehicle
          return (
            c.employmentType === staff.employment_type &&
            item.vehicle_type_id === null
          );
        });

        if (col) {
          const key = `${item.area_id}_${col.key}`;
          initialDraft[key] = item.wage_amount.toString();
        }
      });

      // Restore any previously unsaved draft from IndexedDB cache
      const savedDraft = await getDraft();
      if (savedDraft && Object.keys(savedDraft).length > 0) {
        Object.assign(initialDraft, savedDraft);
        toast.info("Unsaved changes restored from cache.", { id: 'draft-restore' });
      }

      setDraft(initialDraft);

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

  // Auto-persist draft to IndexedDB whenever it changes
  useEffect(() => {
    if (Object.keys(draft).length > 0) {
      saveDraft(draft);
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
      
      // Pre-compute O(1) lookup map for existing matrix items
      const matrixLookup: Record<string, SalaryMatrix> = {};
      data.matrix.forEach(m => {
        matrixLookup[`${m.area_id}_${m.staff_id}_${m.vehicle_type_id}`] = m;
      });
      
      // Construct payload from draft
      Object.entries(draft).forEach(([key, value]) => {
        const index = key.indexOf('_');
        const areaIdStr = key.substring(0, index);
        const colKey = key.substring(index + 1);
        const areaId = Number(areaIdStr);
        const amount = parseFloat(value);
        if (isNaN(amount)) return;

        const colConfig = columns.find(c => c.key === colKey);
        const staff = staffByColumn[colKey];
        if (!staff || !colConfig) return;

        const vtId = getVehicleTypeId(colConfig.vehicleType);

        const record = {
          area_id: areaId,
          staff_id: staff.staff_id,
          vehicle_type_id: vtId,
          wage_amount: amount
        };

        const existing = matrixLookup[`${areaId}_${staff.staff_id}_${vtId}`];

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
        const savePromise = Promise.all(promises);
        toast.promise(savePromise, {
          loading: 'Saving wage matrix...',
          success: () => {
            clearDraft();
            setLastUpdated(new Date().toLocaleTimeString());
            loadData();
            return `Matrix saved: ${updates.length} updated, ${creates.length} created.`;
          },
          error: 'Failed to save matrix.'
        });
        await savePromise;
      } else {
        toast.info("No changes to save.", { id: 'no-changes' });
      }
    } catch (error) {
      console.error(error);
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

    columns.forEach(col => {
      const found = data.staff.find(s => {
        const matchesRole = s.role === col.role;

        if (col.role === 'Driver') {
          // All driver wage buckets share the same staff record in this schema.
          // We only need a Driver staff to exist — the vehicle_type_id that
          // identifies the bucket comes from the MatrixColumn, not the staff row.
          return matchesRole;
        }

        // Helper / Logistics Crew: additionally match employment_type
        return matchesRole && s.employment_type === (col.employmentType ?? null);
      });
      mapping[col.key] = found;
    });

    return mapping;
  }, [data, columns]);

  const vehicleTypeMap = useMemo(() => {
    if (!data) return {};
    const map: Record<string, number> = {};
    data.vehicleTypes.forEach(vt => {
      map[vt.type_name] = vt.id;
    });
    return map;
  }, [data]);

  const getVehicleTypeId = useCallback((vtName: string | undefined): number | null => {
    if (!vtName) return null;
    return vehicleTypeMap[vtName] || null;
  }, [vehicleTypeMap]);

  const getCellValue = (areaId: number, colKey: string): string => {
    const key = `${areaId}_${colKey}`;
    return draft[key] || "";
  };

  // Global count of cells that differ from (or don't exist in) the saved matrix
  const unsavedCount = useMemo(() => {
    if (!data) return 0;
    const matrixLookup: Record<string, string> = {};
    data.matrix.forEach(m => {
      matrixLookup[`${m.area_id}_${m.staff_id}_${m.vehicle_type_id}`] = m.wage_amount.toString();
    });

    let count = 0;
    Object.entries(draft).forEach(([key, value]) => {
      if (!value) return;
      const underscoreIdx = key.indexOf('_');
      const areaId = Number(key.substring(0, underscoreIdx));
      const colKey  = key.substring(underscoreIdx + 1);
      const colConfig = columns.find(c => c.key === colKey);
      const staff    = staffByColumn[colKey];
      if (!colConfig || !staff) return;
      const vtId = colConfig.vehicleTypeId ?? getVehicleTypeId(colConfig.vehicleType);
      const dbKey = `${areaId}_${staff.staff_id}_${vtId}`;
      const dbValue = matrixLookup[dbKey];
      if (dbValue === undefined || dbValue !== value) count++;
    });
    return count;
  }, [data, draft, columns, staffByColumn, getVehicleTypeId]);

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
      <TooltipProvider delayDuration={300}>
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-8 bg-slate-50/30 dark:bg-slate-950/30 min-h-screen">
        <WageMatrixHeader 
          lastUpdated={lastUpdated}
          searchTerm={searchTerm}
          unsavedCount={unsavedCount}
          onSearchChange={setSearchTerm}
          onRefresh={loadData}
          onSave={handleSave}
          saving={saving}
        />

        <Separator className="bg-slate-200/60 dark:bg-slate-800/60" />

        {Object.keys(areasByMode).map((mode) => {
          const areas = filteredAreas(mode);
          if (areas.length === 0 && searchTerm) return null;

          return (
            <WageMatrixTable 
              key={mode}
              mode={mode}
              areas={areas}
              data={data}
              columns={columns}
              staffByColumn={staffByColumn}
              getVehicleTypeId={getVehicleTypeId}
              getCellValue={getCellValue}
              handleInputChange={handleInputChange}
            />
          );
        })}

        {searchTerm && Object.values(areasByMode).every(arr => arr.filter(a => a.area_name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0) && (
          <WageMatrixEmptyState onClearSearch={() => setSearchTerm("")} />
        )}
      </div>
      </TooltipProvider>

    </DashboardLayout>
  );
}
