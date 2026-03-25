// modules/benefit-settings/BenefitSettingsModule.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";

import { BENEFITS } from "./index";
import type { BenefitCode, BenefitSetting, UserData, CutoffSetting, Department } from "./types";

import BenefitCard from "./components/BenefitCard";
import SaveButton from "./components/SaveButton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  fetchBenefitSettings,
  fetchUsers,
  saveBenefitSetting,
  fetchCutoffSettings,
  fetchDepartments,
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
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const userMap = React.useMemo(() => {
    const m = new Map<number, string>();
    for (const u of users)
      m.set(u.user_id, `${u.user_fname} ${u.user_lname}`.trim());
    return m;
  }, [users]);

  const [cutoffs, setCutoffs] = React.useState<CutoffSetting[]>([]);

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
      const [u, s, c, d] = await Promise.all([
        fetchUsers(),
        fetchBenefitSettings(),
        fetchCutoffSettings(),
        fetchDepartments(),
      ]);
      setUsers(u);
      setCutoffs(c);
      setDepartments(d);

      const byCode: Record<BenefitCode, BenefitSetting> = {
        SSS: makeDefaultSetting("SSS", "SSS"),
        PAGIBIG: makeDefaultSetting("PAGIBIG", "Pagibig"),
        PHILHEALTH: makeDefaultSetting("PHILHEALTH", "Philhealth"),
      };

      for (const row of s) {
        byCode[row.benefit_code] = row;
      }

      // SYNC: Ensure effective dates match current cutoff settings if already set
      for (const code of Object.keys(byCode) as BenefitCode[]) {
        const setting = byCode[code];
        if (setting.cutoff) {
          const match = c.find((x) => x.cutoff_type === setting.cutoff);
          if (match) {
            setting.effective_from = match.start_date;
            setting.effective_to = match.end_date;
          }
        }
      }

      setSettings(byCode);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load Manage Benefits data.";
      toast.error(msg);
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
      setSettings((prev) => {
        const next = { ...prev };
        const setting = { ...next[code], cutoff: newValue };

        // Auto-set dates based on selected cutoff
        if (newValue) {
          const match = cutoffs.find((c) => c.cutoff_type === newValue);
          if (match) {
            setting.effective_from = match.start_date;
            setting.effective_to = match.end_date;
          }
        } else {
           setting.effective_from = null;
           setting.effective_to = null;
        }
        
        next[code] = setting;
        return next;
      });
    },
    [cutoffs]
  );



  const onSaveAll = React.useCallback(async () => {
    setSaving(true);
    setStatus("idle");
    try {
      // You can replace this with session user later
      const updatedBy = 176;

      for (const b of BENEFITS) {
        const row = settings[b.code];
        // Ensure we save the correct derived dates
        if (row.cutoff) {
             const match = cutoffs.find((c) => c.cutoff_type === row.cutoff);
             if (match) {
                 row.effective_from = match.start_date;
                 row.effective_to = match.end_date;
             }
        }
        await saveBenefitSetting({ ...row, updated_by: updatedBy });
      }

      toast.success("Benefit settings saved.");
      setStatus("success");
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save benefit settings.";
      toast.error(msg);
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }, [settings, load, cutoffs]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Top: Manage Benefits (Settings) */}
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-base font-semibold text-slate-900 dark:text-gray-100">
                Manage Benefits
              </div>
              <div className="text-xs text-slate-500 dark:text-gray-400">
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
                />
              ))
            )}
          </div>

        </div>

        {/* Bottom: Tabs (Loans + Logs) */}
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <Tabs defaultValue="loans" className="w-full">
            {/* Tabs header styled like your other modules */}
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                  Benefits Operations
                </div>
                <div className="text-xs text-slate-500 dark:text-gray-400">
                  Loans are for SSS & Pagibig only. Logs are view-only and
                  appear after payroll run posting.
                </div>
              </div>

              <TabsList className="w-full justify-start rounded-lg bg-slate-100 dark:bg-gray-800 p-1">
                <TabsTrigger value="loans" className="rounded-md dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100">
                  Benefit Loans
                </TabsTrigger>
                <TabsTrigger value="logs" className="rounded-md dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100">
                  Benefit Logs
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="mt-4">
              <TabsContent value="loans" className="m-0">
                <BenefitLoansTab users={users} />
              </TabsContent>

              <TabsContent value="logs" className="m-0">
                <BenefitLogsTab users={users} departments={departments} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
