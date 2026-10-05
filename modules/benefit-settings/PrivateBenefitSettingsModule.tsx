// modules/benefit-settings/PrivateBenefitSettingsModule.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";

import { BENEFITS } from "./index";
import type {
  BenefitCode,
  BenefitSetting,
  UserData,
  CutoffSetting,
  Department,
  EmployeeBenefitCoverage,
  BenefitReportFilter,
} from "./types";

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
  fetchEmployeeBenefitCoverages,
  fetchCompanyConfig,
} from "./providers/benefitApi";

import BenefitLoansTab from "./components/BenefitLoansTab";
import BenefitLogsTab from "./components/BenefitLogsTab";
import EmployeeBenefitsTab from "./components/EmployeeBenefitsTab";
import BenefitEmployeesDialog from "./components/BenefitEmployeesDialog";
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

export default function PrivateBenefitSettingsModule() {
  const [loading, setLoading] = React.useState(true);
  const [coveragesLoading, setCoveragesLoading] = React.useState(true);

  const [users, setUsers] = React.useState<UserData[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [coverages, setCoverages] = React.useState<EmployeeBenefitCoverage[]>([]);
  const [companyName, setCompanyName] = React.useState("MEN2 MARKETING CORPORATION");

  const [activeTab, setActiveTab] = React.useState<string>("employees");
  const [selectedReportBenefit, setSelectedReportBenefit] = React.useState<BenefitReportFilter>("ALL");

  // Dialog state for quick employee list per card
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogBenefit, setDialogBenefit] = React.useState<BenefitCode>("SSS");

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
    setCoveragesLoading(true);
    try {
      const [u, s, c, d, cov, cfg] = await Promise.all([
        fetchUsers(),
        fetchBenefitSettings(),
        fetchCutoffSettings(),
        fetchDepartments(),
        fetchEmployeeBenefitCoverages({ isGovernment: false }).catch((err) => {
          console.error("Failed to load employee coverages:", err);
          return [] as EmployeeBenefitCoverage[];
        }),
        fetchCompanyConfig().catch(() => ({ companyName: "MEN2 MARKETING CORPORATION" })),
      ]);
      setUsers(u);
      setCutoffs(c);
      setDepartments(d);
      setCoverages(cov);
      if (cfg?.companyName) setCompanyName(cfg.companyName);

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
      setCoveragesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Aggregate stats per benefit card
  const benefitStats = React.useMemo(() => {
    const res: Record<BenefitCode, { count: number; totalAmount: number }> = {
      SSS: { count: 0, totalAmount: 0 },
      PAGIBIG: { count: 0, totalAmount: 0 },
      PHILHEALTH: { count: 0, totalAmount: 0 },
    };
    for (const c of coverages) {
      if (c.sss.personal_share > 0) {
        res.SSS.count++;
        res.SSS.totalAmount += c.sss.personal_share;
      }
      if (c.pagibig.personal_share > 0) {
        res.PAGIBIG.count++;
        res.PAGIBIG.totalAmount += c.pagibig.personal_share;
      }
      if (c.philhealth.personal_share > 0) {
        res.PHILHEALTH.count++;
        res.PHILHEALTH.totalAmount += c.philhealth.personal_share;
      }
    }
    return res;
  }, [coverages]);

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
                Configure which cutoff deducts each contribution, review employee enrollment and amounts, and monitor benefit loans and logs.
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
                  enrolledCount={benefitStats[b.code]?.count ?? 0}
                  totalMonthlyAmount={benefitStats[b.code]?.totalAmount ?? 0}
                  onViewEmployees={(code) => {
                    setDialogBenefit(code);
                    setDialogOpen(true);
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Bottom: Tabs (Employee Benefits Report + Loans + Logs) */}
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                  Benefits Operations &amp; Reports
                </div>
                <div className="text-xs text-slate-500 dark:text-gray-400">
                  Review employee benefit coverage and amounts, track statutory loans, and view posted deduction logs.
                </div>
              </div>

              <TabsList className="w-full justify-start rounded-lg bg-slate-100 dark:bg-gray-800 p-1 flex-wrap h-auto">
                <TabsTrigger
                  value="employees"
                  className="rounded-md dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100 font-semibold text-xs"
                >
                  Employee Benefits Report ({coverages.length})
                </TabsTrigger>
                <TabsTrigger
                  value="loans"
                  className="rounded-md dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100 text-xs"
                >
                  Benefit Loans
                </TabsTrigger>
                <TabsTrigger
                  value="logs"
                  className="rounded-md dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100 text-xs"
                >
                  Benefit Logs
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="mt-4">
              <TabsContent value="employees" className="m-0">
                <EmployeeBenefitsTab
                  coverages={coverages}
                  departments={departments}
                  settings={settings}
                  isGovernment={false}
                  companyName={companyName}
                  loading={coveragesLoading}
                  onRefresh={load}
                  defaultBenefitFilter={selectedReportBenefit}
                />
              </TabsContent>

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

      {/* Quick Focused Dialog per Benefit Card */}
      <BenefitEmployeesDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        benefitCode={dialogBenefit}
        coverages={coverages}
        isGovernment={false}
        companyName={companyName}
        onSwitchToFullReport={() => {
          setActiveTab("employees");
          setSelectedReportBenefit(dialogBenefit);
        }}
      />
    </DashboardLayout>
  );
}

