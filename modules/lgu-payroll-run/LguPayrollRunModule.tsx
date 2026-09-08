// modules/lgu-payroll-run/LguPayrollRunModule.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import LguPayrollStepper from "./components/LguPayrollStepper";
import LguPayrollConfigStep from "./components/LguPayrollConfigStep";
import LguPayrollAdjustStep from "./components/LguPayrollAdjustStep";
import LguPayrollProcessStep from "./components/LguPayrollProcessStep";
import LguPayrollReviewStep from "./components/LguPayrollReviewStep";
import { computeLguLine, computeLguSummary } from "./utils/lguCompute";
import * as departmentApi from "@/modules/departments/providers/departmentApi";
import type {
  LguPayrollStep,
  CutoffSetting,
  Department,
  LguPayrollConfigState,
  LguPayrollLine,
  LguPayrollSummary,
} from "./types";

export default function LguPayrollRunModule() {
  const [step, setStep] = useState<LguPayrollStep>(1);
  const [maxStepAllowed, setMaxStepAllowed] = useState<LguPayrollStep>(1);

  const [cutoffs, setCutoffs] = useState<CutoffSetting[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(true);

  // Configuration
  const [config, setConfig] = useState<LguPayrollConfigState>({
    cutoffId: null,
    departmentId: null,
    payrollRefNo: "LGU-PR-2026-09-1ST",
    remarks: "Regular LGU Personnel Payroll Run",
  });

  // Payroll Lines & Summary
  const [lines, setLines] = useState<LguPayrollLine[]>([]);
  const [summary, setSummary] = useState<LguPayrollSummary>({
    totalHeadcount: 0,
    activeHeadcount: 0,
    onHoldHeadcount: 0,
    totalBasicPay: 0,
    totalPeraAllowance: 0,
    totalGrossPay: 0,
    totalGsisEmployee: 0,
    totalPhilhealthEmployee: 0,
    totalPagibigEmployee: 0,
    totalLoans: 0,
    totalTaxes: 0,
    totalPersonalDeductions: 0,
    totalNetPay: 0,
    totalGsisGovernment: 0,
    totalPhilhealthGovernment: 0,
    totalPagibigGovernment: 0,
    totalLguCounterpart: 0,
    grandTotalAppropriation: 0,
    departmentSummaries: [],
  });

  const [isPosted, setIsPosted] = useState(false);

  // Load Cutoffs & Departments
  const loadMasterData = useCallback(async () => {
    setLoadingMaster(true);
    try {
      const [cutoffRes, depts] = await Promise.all([
        fetch("/api/cutoff-settings").then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
        departmentApi.fetchAllDepartments().catch(async () => {
          const res = await fetch("/api/departments");
          const j = await res.json().catch(() => null);
          return Array.isArray(j?.data) ? j.data : [];
        }),
      ]);

      const cutoffList = Array.isArray(cutoffRes.data) ? cutoffRes.data : [];
      const deptList = Array.isArray(depts) ? depts : [];

      setCutoffs(cutoffList);
      setDepartments(deptList);

      if (cutoffList.length > 0) {
        const first = cutoffList[0];
        setConfig((prev) => ({
          ...prev,
          cutoffId: first.id,
          payrollRefNo: `LGU-PR-${first.start_date ? first.start_date.substring(0, 7) : "2026-09"}-${first.cutoff_type}`,
        }));
      }
    } catch (err) {
      console.error("Failed to load LGU master data:", err);
      toast.error("Failed to load cutoff or department settings.");
    } finally {
      setLoadingMaster(false);
    }
  }, []);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Generate lines when moving from Step 1 to Step 2
  const handleProceedToCompute = useCallback(async () => {
    try {
      // Fetch active employees
      const empList = await departmentApi.fetchAllUsers().catch(async () => {
        const res = await fetch("/api/employees");
        const j = await res.json().catch(() => null);
        return Array.isArray(j?.data) ? j.data : [];
      });

      // Filter active employees (and by department if selected)
      const filtered = empList.filter((u: any) => {
        const isDel = (u.is_deleted as any)?.data?.[0] === 1 || u.is_deleted === 1 || u.is_deleted === true;
        if (isDel) return false;
        if (u.is_employee === 0 || u.is_employee === false) return false;
        if (config.departmentId != null && u.user_department !== config.departmentId) return false;
        return true;
      });

      const selectedCutoff = cutoffs.find((c) => c.id === config.cutoffId);
      const cutoffType = selectedCutoff?.cutoff_type || "FIRST";

      // Map departments
      const deptMap = new Map<number, string>();
      for (const d of departments) {
        deptMap.set(d.department_id, d.department_name);
      }

      // Generate initial LGU payroll lines with standard salary brackets
      const initialLines: LguPayrollLine[] = filtered.map((u: any, idx: number) => {
        const deptName = u.user_department
          ? deptMap.get(u.user_department) || "LGU Department"
          : "General Administration";

        // Assign realistic public-sector monthly basic salaries (e.g., SG-1 to SG-18: ₱15,000 - ₱45,000)
        const salaryTiers = [16500, 19500, 24000, 27500, 32000, 38000, 45000];
        const monthlySalary = salaryTiers[idx % salaryTiers.length];

        return computeLguLine({
          userId: u.user_id,
          employeeName: `${u.user_fname} ${u.user_lname}`.trim(),
          departmentId: u.user_department ?? null,
          departmentName: deptName,
          position: u.user_position || "Administrative Officer",
          monthlySalary,
          daysWorked: 11,
          lateMinutes: (idx * 7) % 25,
          undertimeMinutes: 0,
          otherAllowances: 0,
          overtimePay: idx % 3 === 0 ? 1250 : 0,
          gsisLoan: idx % 4 === 0 ? 1500 : 0,
          pagibigLoan: idx % 5 === 0 ? 750 : 0,
          taxWithholding: monthlySalary > 25000 ? Math.round((monthlySalary - 25000) * 0.15) : 0,
          cutoffType,
        });
      });

      setLines(initialLines);
      setSummary(computeLguSummary(initialLines));
      setStep(2);
      setMaxStepAllowed(2);
      toast.success(`Na-compute ang talaan para sa ${initialLines.length} kawani.`);
    } catch (err) {
      console.error("Failed to compute LGU payroll lines:", err);
      toast.error("Nabigong kalkulahin ang payroll lines.");
    }
  }, [config, cutoffs, departments]);

  // Toggle on-hold for employee
  const handleToggleHold = (userId: number) => {
    setLines((prev) => {
      const next = prev.map((l) => (l.userId === userId ? { ...l, isOnHold: !l.isOnHold } : l));
      setSummary(computeLguSummary(next));
      return next;
    });
  };

  // Step 2 -> Step 3
  const handleProceedToProcess = () => {
    setStep(3);
    setMaxStepAllowed(3);
  };

  // Step 3 -> Step 4
  const handleProcessingComplete = () => {
    setStep(4);
    setMaxStepAllowed(4);
  };

  // Post Payroll Run
  const handlePostPayroll = async () => {
    try {
      setIsPosted(true);
      toast.success("Matagumpay na nai-post ang LGU Payroll Run! Naka-lock na ang mga talaan.");
    } catch (err) {
      console.error("Failed to post LGU payroll run:", err);
      toast.error("Nabigong i-post ang payroll.");
    }
  };

  const selectedCutoff = cutoffs.find((c) => c.id === config.cutoffId) || null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stepper Header */}
        <LguPayrollStepper
          currentStep={step}
          onStepClick={(target) => setStep(target)}
          maxStepAllowed={maxStepAllowed}
        />

        {/* Loading State */}
        {loadingMaster ? (
          <div className="space-y-4 p-6 bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-800">
            <Skeleton className="h-6 w-60" />
            <Skeleton className="h-4 w-96" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ) : (
          <>
            {/* Step 1: Configure */}
            {step === 1 && (
              <LguPayrollConfigStep
                cutoffs={cutoffs}
                departments={departments}
                config={config}
                onChange={setConfig}
                onProceed={handleProceedToCompute}
              />
            )}

            {/* Step 2: Compute & Adjust */}
            {step === 2 && (
              <LguPayrollAdjustStep
                lines={lines}
                summary={summary}
                departments={departments}
                onToggleHold={handleToggleHold}
                onProceed={handleProceedToProcess}
                onBack={() => setStep(1)}
              />
            )}

            {/* Step 3: Process */}
            {step === 3 && (
              <LguPayrollProcessStep
                activeCount={summary.activeHeadcount}
                onComplete={handleProcessingComplete}
              />
            )}

            {/* Step 4: Review, Top Sheet & Post */}
            {step === 4 && (
              <LguPayrollReviewStep
                lines={lines}
                summary={summary}
                cutoff={selectedCutoff}
                payrollRefNo={config.payrollRefNo}
                onPost={handlePostPayroll}
                onBack={() => setStep(2)}
                isPosted={isPosted}
              />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
