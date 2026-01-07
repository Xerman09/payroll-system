// modules/cutoff-settings/CutoffSettingsModule.tsx
"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Layers, Save, CheckCircle2, XCircle } from "lucide-react";

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

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import CutoffSettingsTable from "./components/CutoffSettingsTable";
import CutoffSettingsModal from "./components/CutoffSettingsModal";

type SaveState = "idle" | "success" | "error";

function SaveButton({
  saving,
  status,
  onClick,
}: {
  saving: boolean;
  status: SaveState;
  onClick: () => void;
}) {
  const icon =
    status === "success" ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : status === "error" ? (
      <XCircle className="h-4 w-4" />
    ) : (
      <Save className="h-4 w-4" />
    );

  return (
    <Button onClick={onClick} disabled={saving} className="gap-2">
      {icon}
      {saving ? "Saving..." : "Save Changes"}
    </Button>
  );
}

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
  const [saveStatus, setSaveStatus] = useState<SaveState>("idle");

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

  async function loadUsers() {
    try {
      const users = await listUsers();
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
    } catch (e: any) {
      toast.error(e?.message || "Failed to load cutoff settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function applyRow(updated: CutoffSettingRow) {
    if (updated.cutoff_type === "FIRST") setFirst(updated);
    if (updated.cutoff_type === "SECOND") setSecond(updated);
  }

  async function handleSave() {
    try {
      if (!first || !second) {
        toast.error("Cutoff rows are not loaded yet.");
        return;
      }

      const userId = getSessionUserId();
      if (!userId) {
        toast.error("No session user found in sessionStorage.");
        return;
      }

      setSaving(true);
      setSaveStatus("idle");

      const payload = [
        toEditablePayload(stampAuditFields(first, userId)),
        toEditablePayload(stampAuditFields(second, userId)),
      ];

      await upsertCutoffSettings(payload);

      setSaveStatus("success");
      toast.success("Cutoff settings saved successfully.");
      setTimeout(() => setSaveStatus("idle"), 800);

      await loadCutoffs();
      await loadUsers(); // reload names in case user table changed (optional)
    } catch (e: any) {
      setSaveStatus("error");
      toast.error(e?.message || "Failed to save cutoff settings.");
      setTimeout(() => setSaveStatus("idle"), 1200);
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

            <div className="hidden md:block">
              <SaveButton
                saving={saving}
                status={saveStatus}
                onClick={handleSave}
              />
            </div>
          </div>
        </div>

        <Separator />

        {loading ? (
          <div className="text-sm text-muted-foreground">
            Loading cutoff settings…
          </div>
        ) : (
          <CutoffSettingsTable
            first={first}
            second={second}
            onEdit={handleEdit}
            getUserName={getUserName}
          />
        )}

        <div className="md:hidden sticky bottom-4">
          <SaveButton
            saving={saving}
            status={saveStatus}
            onClick={handleSave}
          />
        </div>

        <CutoffSettingsModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          row={editing}
          period={period}
          onConfirm={applyRow}
        />
      </div>
    </DashboardLayout>
  );
}
