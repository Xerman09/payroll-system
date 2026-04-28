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
import { getLoggedUser } from '@/lib/auth';

import { getDraft, saveDraft, clearDraft } from '@/lib/wageMatrixCache';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WageMatrixHeader } from './components/WageMatrixHeader';
import { WageMatrixTable } from './components/WageMatrixTable';
import { WageMatrixEmptyState } from './components/WageMatrixEmptyState';

const shortenVT = (name: string) => {
  return name
    .replace(/ WHEELER TRUCK/i, "W")
    .replace(/ WHEELER/i, "W")
    .replace(/ TRUCK/i, "")
    .trim();
};

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
        label: shortenVT(vt.type_name),
        group: 'Fleet Operator',
        role: 'Driver' as const,
        vehicleType: vt.type_name,
        vehicleTypeId: vt.id
      }));

    // Standard helper columns
    const helperCols = [
      { key: 'helper_extra', label: 'Extra', group: 'Helper', role: 'Helper' as const, employmentType: 'EXTRA' },
      { key: 'helper_probationary', label: 'Probationary', group: 'Helper', role: 'Helper' as const, employmentType: 'PROBATIONARY' },
    ];

    // Dynamic Helper columns based on assigned vehicles for Regular categories - ONLY ACTIVE STAFF
    const relevantStaff = data.staff.filter(s => 
      s.is_deleted !== 1 &&
      s.role === 'Helper' && 
      (s.employment_type === 'REGULAR(<10W)' || s.employment_type === 'REGULAR(10W/T)') &&
      s.vehicle_type_id !== null
    );

    // Group by unique (employment_type, vehicle_type_id)
    const seen = new Set<string>();
    const dynamicCrewCols: MatrixColumn[] = [];

    relevantStaff.forEach(s => {
      const key = `${s.employment_type}_${s.vehicle_type_id}`;
      if (seen.has(key)) return;
      seen.add(key);

      const vt = data.vehicleTypes.find(v => v.id === s.vehicle_type_id);
      const vtName = vt?.type_name || `VT ${s.vehicle_type_id}`;
      const vtLabel = shortenVT(vtName);



      dynamicCrewCols.push({
        key: `helper_${s.employment_type}_vt${s.vehicle_type_id}`,
        label: `REGULAR (${vtLabel})`,
        group: 'Logistics Crew',
        role: 'Helper' as const,
        employmentType: s.employment_type || undefined,
        vehicleTypeId: s.vehicle_type_id || undefined,
        vehicleType: vtLabel
      });
    });

    // Base Regular columns — only include if there's an ACTIVE staff member with NO assigned vehicle
    const baseCrewChoices = [
      { key: 'logistics_regular_lt_10w', label: 'Regular (<10W)', group: 'Logistics Crew', role: 'Helper' as const, employmentType: 'REGULAR(<10W)' },
      { key: 'logistics_regular_10w_t', label: 'Regular (10W/T)', group: 'Logistics Crew', role: 'Helper' as const, employmentType: 'REGULAR(10W/T)' },
    ].filter(base => data.staff.some(s => s.is_deleted !== 1 && s.role === 'Helper' && s.employment_type === base.employmentType && s.vehicle_type_id === null));

    const crewCols = [...baseCrewChoices, ...dynamicCrewCols];

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

      const localDynamicCrewCols: Array<{
        key: string;
        role: 'Driver' | 'Helper';
        vehicleTypeId?: number;
        employmentType?: string;
      }> = [];
      const seen = new Set<string>();
      res.staff
        .filter(s => s.is_deleted !== 1 && s.role === 'Helper' && (s.employment_type === 'REGULAR(<10W)' || s.employment_type === 'REGULAR(10W/T)') && s.vehicle_type_id !== null)
        .forEach(s => {
          const key = `${s.employment_type}_${s.vehicle_type_id}`;
          if (seen.has(key)) return;
          seen.add(key);
          localDynamicCrewCols.push({
            key: `helper_${s.employment_type}_vt${s.vehicle_type_id}`,
            role: 'Helper' as const,
            vehicleTypeId: s.vehicle_type_id || undefined,
            employmentType: s.employment_type || undefined,
          });
        });

      const localBaseCrewChoices = [
        { key: 'logistics_regular_lt_10w', role: 'Helper' as const, vehicleTypeId: undefined as number | undefined, employmentType: 'REGULAR(<10W)'  },
        { key: 'logistics_regular_10w_t',  role: 'Helper' as const, vehicleTypeId: undefined as number | undefined, employmentType: 'REGULAR(10W/T)' },
      ];

      const localCrewCols = [...localBaseCrewChoices, ...localDynamicCrewCols];

      const localCols = [...localDriverCols, ...localHelperCols, ...localCrewCols];

      // Initialize draft from matrix data using the local columns
      // Logic: Match items by (role, employment_type, vehicle_type_id) to the defined columns
      const initialDraft: Record<string, string> = {};
      res.matrix.forEach(item => {
        const itemStaff = res.staff.find(s => s.staff_id === item.staff_id);
        if (!itemStaff) return;

        const col = localCols.find(c => {
          if (itemStaff.role !== c.role) return false;

          if (c.role === 'Driver') {
            return c.vehicleTypeId === item.vehicle_type_id;
          }

          // Helper / Logistics Crew: Match by category rather than specific staff_id
          // This ensures if a staff_id changed but category is same, the old rate shows up.
          return (
            c.employmentType === itemStaff.employment_type &&
            (item.vehicle_type_id === (c.vehicleTypeId ?? null))
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
    
    // Get current user ID for audit trails
    const user = getLoggedUser();
    const userId = user?.user_id ?? null;

    try {
      const updates: SalaryMatrix[] = [];
      const creates: SalaryMatrix[] = [];
      
      // Pre-compute O(1) lookup map for existing matrix items
      // Key: areaId_role_empType_vtId
      const matrixLookup: Record<string, SalaryMatrix> = {};
      data.matrix.forEach(m => {
        const mStaff = data.staff.find(s => s.staff_id === m.staff_id);
        if (!mStaff) return;
        
        const vtIdPart = m.vehicle_type_id !== null ? `vt${m.vehicle_type_id}` : 'vt_null';
        const empTypePart = mStaff.employment_type ? mStaff.employment_type : 'emp_null';
        const lookupKey = `${m.area_id}_${mStaff.role}_${empTypePart}_${vtIdPart}`;
        
        // If multiple exist (orphans), the active one will likely be processed last or we just pick one
        matrixLookup[lookupKey] = m;
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

        const vtId = colConfig.vehicleTypeId ?? getVehicleTypeId(colConfig.vehicleType);
        
        // Look up by category to see if we should UPDATE an existing record (even with different staff_id)
        const vtIdPart = vtId !== null ? `vt${vtId}` : 'vt_null';
        const empTypePart = colConfig.employmentType ? colConfig.employmentType : 'emp_null';
        const lookupKey = `${areaId}_${colConfig.role}_${empTypePart}_${vtIdPart}`;
        
        const existing = matrixLookup[lookupKey];

        const record = {
          area_id: areaId,
          staff_id: staff.staff_id, // Always use the CURRENT template staff_id
          vehicle_type_id: vtId,
          wage_amount: amount
        };

        if (existing?.id) {
          // If record changed, or if we are migrating to a new staff_id
          const hasChanges = existing.wage_amount !== amount || existing.staff_id !== staff.staff_id;
          if (hasChanges) {
            updates.push({ 
              ...record, 
              id: existing.id,
              updated_by: userId
            });
          }
        } else {
          creates.push({
            ...record,
            created_by: userId,
            updated_by: userId
          });
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
        const matchesActive = s.is_deleted !== 1;

        if (col.role === 'Driver') {
          return matchesRole && matchesActive;
        }

        // Helper / Logistics Crew: additionally match employment_type + vehicle_type_id
        return matchesRole && 
               matchesActive &&
               s.employment_type === (col.employmentType ?? null) &&
               s.vehicle_type_id === (col.vehicleTypeId ?? null);
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
    
    // Pre-calculate column lookup for O(1) access
    const columnLookup: Record<string, MatrixColumn> = {};
    columns.forEach(c => { columnLookup[c.key] = c; });

    // Pre-calculate numeric matrix lookup for O(1) access
    const matrixLookup: Record<string, number> = {};
    data.matrix.forEach(m => {
      matrixLookup[`${m.area_id}_${m.staff_id}_${m.vehicle_type_id}`] = Number(m.wage_amount);
    });

    let count = 0;
    Object.entries(draft).forEach(([key, value]) => {
      const amount = parseFloat(value);
      if (isNaN(amount)) return;

      const underscoreIdx = key.indexOf('_');
      const areaId = Number(key.substring(0, underscoreIdx));
      const colKey = key.substring(underscoreIdx + 1);
      
      const colConfig = columnLookup[colKey];
      const staff    = staffByColumn[colKey];
      if (!colConfig || !staff) return;

      const vtId = colConfig.vehicleTypeId ?? getVehicleTypeId(colConfig.vehicleType);
      const dbKey = `${areaId}_${staff.staff_id}_${vtId}`;
      const dbValue = matrixLookup[dbKey];

      // Comparison using numeric values to avoid false dirty states on string formatting
      if (dbValue === undefined || dbValue !== amount) count++;
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
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-8 bg-slate-50/30 dark:bg-slate-950/30 min-h-screen wage-matrix">
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
