// modules/unified/benefits-logs/components/UnifiedLogsStats.tsx
"use client";

import * as React from "react";
import { Building2, Landmark, HeartPulse, Wallet, Layers, ShieldCheck } from "lucide-react";
import type { UnifiedBenefitLogRow, CompanySummary } from "../types";

function formatMoney(v: number) {
  if (!Number.isFinite(v)) return "0.00";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface UnifiedLogsStatsProps {
  rows: UnifiedBenefitLogRow[];
  companies: CompanySummary[];
  loading?: boolean;
}

export default function UnifiedLogsStats({ rows, companies, loading }: UnifiedLogsStatsProps) {
  const totals = React.useMemo(() => {
    let grandTotal = 0;
    let sss = 0;
    let philhealth = 0;
    let pagibig = 0;
    let loans = 0;

    for (const r of rows) {
      const amt = r.deducted_amount || 0;
      grandTotal += amt;
      if (r.benefit_code === "SSS") sss += amt;
      if (r.benefit_code === "PHILHEALTH") philhealth += amt;
      if (r.benefit_code === "PAGIBIG") pagibig += amt;
      if (r.log_type === "LOAN") loans += amt;
    }

    const uniqueEmployees = new Set(rows.map((r) => `${r.company_id}-${r.user_id}`)).size;
    const activeCompaniesCount = companies.filter((c) => c.status === "ok").length;

    return {
      grandTotal,
      sss,
      philhealth,
      pagibig,
      loans,
      uniqueEmployees,
      activeCompaniesCount,
    };
  }, [rows, companies]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* Grand Total */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-gray-400">Total Deductions</span>
          <div className="rounded-lg bg-primary/10 p-2 text-primary dark:text-blue-400">
            <Layers className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-gray-100">
            ₱{formatMoney(totals.grandTotal)}
          </div>
          <div className="mt-1 flex items-center text-xs text-slate-500 dark:text-gray-400">
            <span>{rows.length.toLocaleString()} compiled records</span>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
      </div>

      {/* SSS / GSIS */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-gray-400">SSS / GSIS</span>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2 text-blue-600 dark:text-blue-400">
            <Landmark className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold tracking-tight text-blue-700 dark:text-blue-400">
            ₱{formatMoney(totals.sss)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">
            Statutory social security
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500" />
      </div>

      {/* PhilHealth */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-gray-400">PhilHealth</span>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2 text-emerald-600 dark:text-emerald-400">
            <HeartPulse className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
            ₱{formatMoney(totals.philhealth)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">
            Health insurance contributions
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500" />
      </div>

      {/* Pag-IBIG */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-gray-400">Pag-IBIG</span>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-2 text-amber-600 dark:text-amber-400">
            <Wallet className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-400">
            ₱{formatMoney(totals.pagibig)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">
            HDMF fund & savings
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-500" />
      </div>

      {/* Enterprise Reach */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-gray-400">Enterprise Companies</span>
          <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 p-2 text-purple-600 dark:text-purple-400">
            <Building2 className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold tracking-tight text-purple-700 dark:text-purple-400">
            {totals.activeCompaniesCount} / {companies.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">
            {totals.uniqueEmployees.toLocaleString()} employees covered
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-purple-500" />
      </div>
    </div>
  );
}
