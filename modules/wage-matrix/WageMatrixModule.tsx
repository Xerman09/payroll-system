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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { COLUMN_MAP, LOCAL_STORAGE_KEY } from './constants';
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
        const vt = res.vehicleTypes.find(v => v.id === item.vehicle_type_id);
        
        const col = COLUMN_MAP.find(c => {
          const matchesStaff = staff?.role === c.role && (c.employmentType ? staff?.employment_type === c.employmentType : true);
          // For drivers, we match vehicle type. For others, we expect no vehicle type (null)
          const matchesVT = c.vehicleType ? vt?.type_name === c.vehicleType : !vt;
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
        const index = key.indexOf('_');
        const areaIdStr = key.substring(0, index);
        const colKey = key.substring(index + 1);
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
        
        if (col.role === 'Driver') {
           return matchesRole && matchesType;
        }
        
        return matchesRole && matchesType;
      });
      mapping[col.key] = found;
    });

    return mapping;
  }, [data]);

  const getVehicleTypeId = (vtName: string | undefined): number | null => {
    if (!data) return null;
    if (vtName) {
      const found = data.vehicleTypes.find(vt => vt.type_name === vtName);
      if (found) return found.id;
    }
    
    return null;
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
        <WageMatrixHeader 
          lastUpdated={lastUpdated}
          searchTerm={searchTerm}
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
