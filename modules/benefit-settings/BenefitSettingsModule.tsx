// modules/benefit-settings/BenefitSettingsModule.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";

import { BENEFITS } from "./index";
import type { BenefitCode, BenefitSetting, UserData } from "./types";

import BenefitCard from "./components/BenefitCard";
import SaveButton from "./components/SaveButton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  fetchBenefitSettings,
  fetchUsers,
  saveBenefitSetting,
} from "./providers/benefitApi";

import BenefitLoansTab from "./components/BenefitLoansTab";
import BenefitLogsTab from "./components/BenefitLogsTab";
import { BenefitCardSkeleton } from "./components/BenefitSettingsSkeleton";

function makeDefaultSetting(code: BenefitCode, name: string): BenefitSetting {
  return {
    id: 0,
    benefit_code: code,
    benefit_name: name,
    cutoff: null,
    is_active: 1,
    effective_from: null,
    effective_to: null,
    updated_by: null,
    updated_date: null,
  };
}

export default function BenefitSettingsModule() {
  const [loading, setLoading] = React.useState(true);

  const [users, setUsers] = React.useState<UserData[]>([]);
  const userMap = React.useMemo(() => {
    const m = new Map<number, string>();
    for (const u of users)
      m.set(u.user_id, `${u.user_fname} ${u.user_lname}`.trim());
    return m;
  }, [users]);

  const [settings, setSettings] = React.useState<
    Record<BenefitCode, BenefitSetting>
  >({
    SSS: makeDefaultSetting("SSS", "SSS"),
    PAGIBIG: makeDefaultSetting("PAGIBIG", "Pagibig"),
    PHILHEALTH: makeDefaultSetting("PHILHEALTH", "Philhealth"),
  });

  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "success" | "error">(
    "idle"
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([fetchUsers(), fetchBenefitSettings()]);
      setUsers(u);

      const byCode: Record<BenefitCode, BenefitSetting> = {
        SSS: makeDefaultSetting("SSS", "SSS"),
        PAGIBIG: makeDefaultSetting("PAGIBIG", "Pagibig"),
        PHILHEALTH: makeDefaultSetting("PHILHEALTH", "Philhealth"),
      };

      for (const row of s) {
        byCode[row.benefit_code] = row;
      }

      setSettings(byCode);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load Manage Benefits data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const getUserName = React.useCallback(
    (id: number | null) => {
      if (!id) return "—";
      return userMap.get(id) || `User #${id}`;
    },
    [userMap]
  );

  const onCutoff = React.useCallback(
    (code: BenefitCode, newValue: BenefitSetting["cutoff"]) => {
      setStatus("idle");
      setSettings((prev) => ({
        ...prev,
        [code]: { ...prev[code], cutoff: newValue },
      }));
    },
    []
  );

  const onDateChange = React.useCallback(
    (
      code: BenefitCode,
      field: "effective_from" | "effective_to",
      val: string
    ) => {
      setStatus("idle");
      setSettings((prev) => ({
        ...prev,
        [code]: { ...prev[code], [field]: val || null },
      }));
    },
    []
  );

  const onSaveAll = React.useCallback(async () => {
    setSaving(true);
    setStatus("idle");
    try {
      // You can replace this with session user later
      const updatedBy = 176;

      for (const b of BENEFITS) {
        const row = settings[b.code];
        await saveBenefitSetting({ ...row, updated_by: updatedBy });
      }

      toast.success("Benefit settings saved.");
      setStatus("success");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save benefit settings.");
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }, [settings, load]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Top: Manage Benefits (Settings) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-base font-semibold text-slate-900">
                Manage Benefits
              </div>
              <div className="text-xs text-slate-500">
                Configure which cutoff deducts each contribution, then manage
                benefit loans and review posted logs.
              </div>
            </div>

            <SaveButton status={status} saving={saving} onClick={onSaveAll} />
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {loading ? (
              <BenefitCardSkeleton />
            ) : (
              BENEFITS.map((b) => (
                <BenefitCard
                  key={b.code}
                  name={b.name}
                  code={b.code}
                  setting={settings[b.code]}
                  getUserName={getUserName}
                  onCutoff={onCutoff}
                  onDateChange={onDateChange}
                />
              ))
            )}
          </div>

        </div>

        {/* Bottom: Tabs (Loans + Logs) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <Tabs defaultValue="loans" className="w-full">
            {/* Tabs header styled like your other modules */}
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Benefits Operations
                </div>
                <div className="text-xs text-slate-500">
                  Loans are for SSS & Pagibig only. Logs are view-only and
                  appear after payroll run posting.
                </div>
              </div>

              <TabsList className="w-full justify-start rounded-lg bg-slate-100 p-1">
                <TabsTrigger value="loans" className="rounded-md">
                  Benefit Loans
                </TabsTrigger>
                <TabsTrigger value="logs" className="rounded-md">
                  Benefit Logs
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="mt-4">
              <TabsContent value="loans" className="m-0">
                <BenefitLoansTab users={users} />
              </TabsContent>

              <TabsContent value="logs" className="m-0">
                <BenefitLogsTab users={users} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
