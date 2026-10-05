// modules/benefit-settings/government/GovernmentBenefitSettingsModule.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Landmark, Building, Shield, HeartPulse, HandCoins, Info, CheckCircle2 } from "lucide-react";

import { BENEFITS } from "../index";
import type {
  BenefitCode,
  BenefitSetting,
  UserData,
  CutoffSetting,
  Department,
  EmployeeBenefitCoverage,
  BenefitReportFilter,
} from "../types";

import GovernmentBenefitCards from "../components/government/GovernmentBenefitCards";
import GovernmentCalculatorCard from "../components/government/GovernmentCalculatorCard";
import GovernmentLoansTab from "../components/government/GovernmentLoansTab";
import GovernmentLogsTab from "../components/government/GovernmentLogsTab";
import EmployeeBenefitsTab from "../components/EmployeeBenefitsTab";
import BenefitEmployeesDialog from "../components/BenefitEmployeesDialog";
import SaveButton from "../components/SaveButton";
import { BenefitCardSkeleton } from "../components/BenefitSettingsSkeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
} from "../providers/benefitApi";

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

export default function GovernmentBenefitSettingsModule() {
  const [loading, setLoading] = React.useState(true);
  const [coveragesLoading, setCoveragesLoading] = React.useState(true);

  const [users, setUsers] = React.useState<UserData[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [coverages, setCoverages] = React.useState<EmployeeBenefitCoverage[]>([]);
  const [companyName, setCompanyName] = React.useState("LGU - Local Government Unit");

  const [activeTab, setActiveTab] = React.useState<string>("employees");
  const [selectedReportBenefit, setSelectedReportBenefit] = React.useState<BenefitReportFilter>("ALL");

  // Dialog state for card clicks
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogBenefit, setDialogBenefit] = React.useState<BenefitCode>("SSS");

  const userMap = React.useMemo(() => {
    const m = new Map<number, string>();
    for (const u of users)
      m.set(u.user_id, `${u.user_fname} ${u.user_lname}`.trim());
    return m;
  }, [users]);

  const [cutoffs, setCutoffs] = React.useState<CutoffSetting[]>([]);

  const [settings, setSettings] = React.useState<Record<BenefitCode, BenefitSetting>>({
    SSS: makeDefaultSetting("SSS", "GSIS"),
    PAGIBIG: makeDefaultSetting("PAGIBIG", "Pagibig"),
    PHILHEALTH: makeDefaultSetting("PHILHEALTH", "Philhealth"),
  });

  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "success" | "error">("idle");

  const load = React.useCallback(async () => {
    setLoading(true);
    setCoveragesLoading(true);
    try {
      const [u, s, c, d, cov, cfg] = await Promise.all([
        fetchUsers().catch((err) => {
          console.warn("Failed to load users:", err);
          return [] as UserData[];
        }),
        fetchBenefitSettings().catch((err) => {
          console.warn("Failed to load benefit settings:", err);
          return [] as BenefitSetting[];
        }),
        fetchCutoffSettings().catch((err) => {
          console.warn("Failed to load cutoff settings:", err);
          return [] as CutoffSetting[];
        }),
        fetchDepartments().catch((err) => {
          console.warn("Failed to load departments:", err);
          return [] as Department[];
        }),
        fetchEmployeeBenefitCoverages({ isGovernment: true }).catch((err) => {
          console.warn("Failed to load government employee coverages:", err);
          return [] as EmployeeBenefitCoverage[];
        }),
        fetchCompanyConfig().catch(() => ({ companyName: "LGU - Local Government Unit" })),
      ]);
      setUsers(u);
      setCutoffs(c);
      setDepartments(d);
      setCoverages(cov);
      if (cfg?.companyName) setCompanyName(cfg.companyName);

      const byCode: Record<BenefitCode, BenefitSetting> = {
        SSS: makeDefaultSetting("SSS", "GSIS"),
        PAGIBIG: makeDefaultSetting("PAGIBIG", "Pagibig"),
        PHILHEALTH: makeDefaultSetting("PHILHEALTH", "Philhealth"),
      };

      for (const row of s) {
        byCode[row.benefit_code] = row;
      }

      // Sync effective dates matching current cutoff settings if already set
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
      const msg = e instanceof Error ? e.message : "Failed to load Government Benefits data.";
      toast.error(msg);
    } finally {
      setLoading(false);
      setCoveragesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Aggregate stats per card
  const govStats = React.useMemo(() => {
    const res: Record<BenefitCode, { count: number; personal: number; government: number }> = {
      SSS: { count: 0, personal: 0, government: 0 },
      PAGIBIG: { count: 0, personal: 0, government: 0 },
      PHILHEALTH: { count: 0, personal: 0, government: 0 },
    };
    for (const c of coverages) {
      if (c.sss.personal_share > 0) {
        res.SSS.count++;
        res.SSS.personal += c.sss.personal_share;
        res.SSS.government += c.sss.counterpart_share;
      }
      if (c.pagibig.personal_share > 0) {
        res.PAGIBIG.count++;
        res.PAGIBIG.personal += c.pagibig.personal_share;
        res.PAGIBIG.government += c.pagibig.counterpart_share;
      }
      if (c.philhealth.personal_share > 0) {
        res.PHILHEALTH.count++;
        res.PHILHEALTH.personal += c.philhealth.personal_share;
        res.PHILHEALTH.government += c.philhealth.counterpart_share;
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
        if (row.cutoff) {
          const match = cutoffs.find((c) => c.cutoff_type === row.cutoff);
          if (match) {
            row.effective_from = match.start_date;
            row.effective_to = match.end_date;
          }
        }
        await saveBenefitSetting({ ...row, updated_by: updatedBy });
      }

      toast.success("Government benefit settings saved successfully.");
      setStatus("success");
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save government benefit settings.";
      toast.error(msg);
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }, [settings, load, cutoffs]);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Main Header Card */}
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-600 text-white shadow-sm">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-slate-900 dark:text-gray-100">
                      Government Benefits Management (LGU / Public Sector)
                    </h1>
                    <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs">
                      🏛️ LGU / Government Sector
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Pamamahala ng mga statutory contributions (GSIS, PhilHealth, Pag-IBIG), mga pampamahalaang pautang, at LGU counterpart monitoring.
                  </p>
                </div>
              </div>
            </div>

            <SaveButton status={status} saving={saving} onClick={onSaveAll} />
          </div>

          {/* LGU Cost-Sharing Policy Banner */}
          <div className="rounded-lg bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-indigo-50/60 dark:from-blue-950/40 dark:via-sky-950/30 dark:to-indigo-950/20 border border-blue-200/80 dark:border-blue-900/60 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-full bg-blue-600 text-white">
                <Info className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-sm font-bold text-blue-950 dark:text-blue-200">
                Sa LGU / Government, hati ang government sa hulog.
              </h2>
            </div>
            <p className="text-xs text-slate-700 dark:text-gray-300 leading-relaxed">
              Alinsunod sa mga panuntunan para sa mga kawani ng pamahalaang lokal, bawas agad sa payslip ang personal share ng empleyado habang ang LGU naman ang magbabayad ng counterpart share:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="bg-white/80 dark:bg-gray-900/70 p-2.5 rounded-md border border-blue-200/60 dark:border-gray-800 space-y-1">
                <div className="font-bold text-blue-900 dark:text-blue-300 flex items-center justify-between">
                  <span>1. GSIS (Kapalit ng SSS)</span>
                  <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300">21% Total</Badge>
                </div>
                <div className="text-slate-600 dark:text-gray-300 text-[11px]">
                  <strong>9%</strong> Personal Share (bawas agad sa payslip) | <strong>12%</strong> Sagot ng LGU.
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Hal: Sahod ₱25,000 → Ikaw: ₱2,250 | LGU: ₱3,000
                </div>
              </div>

              <div className="bg-white/80 dark:bg-gray-900/70 p-2.5 rounded-md border border-emerald-200/60 dark:border-gray-800 space-y-1">
                <div className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
                  <span>2. PhilHealth</span>
                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">5% Total</Badge>
                </div>
                <div className="text-slate-600 dark:text-gray-300 text-[11px]">
                  <strong>2.5%</strong> Personal Share | <strong>2.5%</strong> Government Share (Hati kayo 50/50).
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Salary bracket: ₱10,000 to ₱100,000 lang ang base.
                </div>
              </div>

              <div className="bg-white/80 dark:bg-gray-900/70 p-2.5 rounded-md border border-amber-200/60 dark:border-gray-800 space-y-1">
                <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center justify-between">
                  <span>3. Pag-IBIG (HDMF)</span>
                  <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">₱200 DBM</Badge>
                </div>
                <div className="text-slate-600 dark:text-gray-300 text-[11px]">
                  <strong>₱100</strong> (min) to <strong>₱200</strong> Personal | <strong>₱100 - ₱200</strong> LGU Share.
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Sa LGU halos lahat ₱200 na per DBM 2024.
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-3" />

          {/* Statutory Cards */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BenefitCardSkeleton />
              <BenefitCardSkeleton />
              <BenefitCardSkeleton />
            </div>
          ) : (
            <GovernmentBenefitCards
              settings={settings}
              getUserName={getUserName}
              onCutoff={onCutoff}
              stats={govStats}
              onViewEmployees={(code) => {
                setDialogBenefit(code);
                setDialogOpen(true);
              }}
            />
          )}
        </div>

        {/* Live Simulator & Calculator */}
        <GovernmentCalculatorCard
          users={users}
          settings={settings}
        />

        {/* Operations Tabs (Employee Benefits Report + Loans + Remittance Logs) */}
        <div className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-gray-100">
                  Government Benefits Operations &amp; Reports
                </div>
                <div className="text-xs text-slate-500 dark:text-gray-400">
                  Ulat sa saklaw ng mga empleyado, pampamahalaang pautang (GSIS &amp; Pag-IBIG), at pagsusuri ng mga nai-post na logs kasama ang LGU cost-sharing.
                </div>
              </div>

              <TabsList className="w-full justify-start rounded-lg bg-slate-100 dark:bg-gray-800 p-1 flex-wrap h-auto">
                <TabsTrigger
                  value="employees"
                  className="rounded-md dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100 text-xs font-semibold"
                >
                  Employee Benefits Report ({coverages.length})
                </TabsTrigger>
                <TabsTrigger
                  value="loans"
                  className="rounded-md dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100 text-xs font-semibold"
                >
                  GSIS &amp; Pag-IBIG Loans
                </TabsTrigger>
                <TabsTrigger
                  value="logs"
                  className="rounded-md dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-gray-100 text-xs font-semibold"
                >
                  LGU Remittance &amp; Logs
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="mt-4">
              <TabsContent value="employees" className="m-0">
                <EmployeeBenefitsTab
                  coverages={coverages}
                  departments={departments}
                  settings={settings}
                  isGovernment={true}
                  companyName={companyName}
                  loading={coveragesLoading}
                  onRefresh={load}
                  defaultBenefitFilter={selectedReportBenefit}
                />
              </TabsContent>

              <TabsContent value="loans" className="m-0">
                <GovernmentLoansTab users={users} />
              </TabsContent>

              <TabsContent value="logs" className="m-0">
                <GovernmentLogsTab users={users} departments={departments} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Focused Dialog per Benefit Card */}
      <BenefitEmployeesDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        benefitCode={dialogBenefit}
        coverages={coverages}
        isGovernment={true}
        companyName={companyName}
        onSwitchToFullReport={() => {
          setActiveTab("employees");
          setSelectedReportBenefit(dialogBenefit);
        }}
      />
    </DashboardLayout>
  );
}

