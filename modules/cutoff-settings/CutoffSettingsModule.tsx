// modules/cutoff-settings/CutoffSettingsModule.tsx
"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Layers } from "lucide-react";

import type { CutoffSettingRow, PeriodKey } from "./types";
import {
  computeCurrentPayrollPeriod,
  ensureTwoRowsForCurrentPayrollPeriod,
  periodLabel,
  upsertCutoffSettings,
  toEditablePayload,
  getSessionUserId,
  listUsers,
  makeUserNameMap,
  getUserDisplayName,
} from "./providers/cutoffSettingsApi";

import { Separator } from "@/components/ui/separator";

import CutoffSettingsTable from "./components/CutoffSettingsTable";
import CutoffSettingsModal from "./components/CutoffSettingsModal";
import CutoffSettingsSkeleton from "./components/CutoffSettingsSkeleton";

function samePeriod(a: PeriodKey, b: PeriodKey) {
  return a.month === b.month && a.year === b.year;
}

function stampAuditFields(
  row: CutoffSettingRow,
  userId: string | null
): CutoffSettingRow {
  if (!userId) return row;

  return {
    ...row,
    created_by: row.created_by ?? userId,
    updated_by: userId,
  };
}

export default function CutoffSettingsModule() {
  const initialPeriod = useMemo(
    () => computeCurrentPayrollPeriod(new Date()),
    []
  );

  const [period, setPeriod] = useState<PeriodKey>(initialPeriod);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [first, setFirst] = useState<CutoffSettingRow | null>(null);
  const [second, setSecond] = useState<CutoffSettingRow | null>(null);

  const [editing, setEditing] = useState<CutoffSettingRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [userNameMap, setUserNameMap] = useState<Map<string, string>>(
    () => new Map()
  );

  const getUserName = useMemo(() => {
    return (id: string | number | null | undefined) =>
      getUserDisplayName(userNameMap, id);
  }, [userNameMap]);

  async function loadUsers(ids?: Array<string | number>) {
    try {
      const users = await listUsers(ids);
      setUserNameMap(makeUserNameMap(users));
    } catch {
      // Non-blocking: module still works, but will show ids.
      toast.error("Failed to load user names.");
    }
  }

  async function loadCutoffs() {
    try {
      setLoading(true);
      const rows = await ensureTwoRowsForCurrentPayrollPeriod(period);

      const f = rows.find((r) => r.cutoff_type === "FIRST") ?? null;
      const s = rows.find((r) => r.cutoff_type === "SECOND") ?? null;

      setFirst(f);
      setSecond(s);

      // Collect unique user ids from the rows
      const userIds = new Set<string | number>();
      rows.forEach((row) => {
        if (row.created_by) userIds.add(row.created_by);
        if (row.updated_by) userIds.add(row.updated_by);
      });
      const ids = Array.from(userIds);

      // Load users for these ids
      await loadUsers(ids);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load cutoff settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCutoffs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.month, period.year]);

  useEffect(() => {
    const intervalMs = 60 * 60 * 1000; // hourly
    const id = window.setInterval(() => {
      const next = computeCurrentPayrollPeriod(new Date());
      setPeriod((prev) => (samePeriod(prev, next) ? prev : next));
    }, intervalMs);

    return () => window.clearInterval(id);
  }, []);

  function handleEdit(row: CutoffSettingRow) {
    setEditing(row);
    setModalOpen(true);
  }

  async function applyAndSaveRow(updated: CutoffSettingRow) {
    try {
      const userId = getSessionUserId();
      if (!userId) {
        toast.error("No session user found in sessionStorage.");
        return;
      }

      setSaving(true);

      const payload = [toEditablePayload(stampAuditFields(updated, userId))];

      await upsertCutoffSettings(payload);

      toast.success("Cutoff settings updated successfully.");

      // Update local state
      if (updated.cutoff_type === "FIRST") setFirst(updated);
      if (updated.cutoff_type === "SECOND") setSecond(updated);

      // Close modal after successful save
      setModalOpen(false);

      // Reload to get fresh data
      await loadCutoffs();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update cutoff settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto p-2 md:p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              Cutoff Settings
            </h2>
            <p className="text-muted-foreground text-sm">
              Maintains exactly 2 rows (FIRST/SECOND). Displays Updated By as
              user name.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-2 rounded-md border text-sm bg-background">
              Current Payroll Month:{" "}
              <span className="font-semibold">{periodLabel(period)}</span>
            </div>
          </div>
        </div>
        <Separator />

        {loading ? (
          <CutoffSettingsSkeleton />
        ) : (
          <CutoffSettingsTable
            first={first}
            second={second}
            onEdit={handleEdit}
            getUserName={getUserName}
          />
        )}

        <CutoffSettingsModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          row={editing}
          period={period}
          onConfirm={applyAndSaveRow}
          saving={saving}
        />
      </div>
    </DashboardLayout>
  );
}
