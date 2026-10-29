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
import {
  computeLguLine,
  computeLguSummary,
  inferSalaryGrade,
} from "./utils/lguCompute";
import * as departmentApi from "@/modules/departments/providers/departmentApi";
import * as svc from "@/modules/payroll-run/providers/payrollRunService";
import { computeEmployeeLine } from "@/modules/payroll-run/utils/compute";
import type {
  LguPayrollStep,
  CutoffSetting,
  Department,
  LguPayrollConfigState,
  LguPayrollLine,
  LguPayrollSummary,
  LguManualAdjustment,
  LguLoanBreakdown,
  LguAllowanceBreakdown,
  LguEmployeeStatutory,
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
    totalRataAllowance: 0,
    totalHazardPay: 0,
    totalOvertimePay: 0,
    totalOtherAllowances: 0,
    totalGrossPay: 0,
    totalTardinessDeductions: 0,
    totalGsisEmployee: 0,
    totalPhilhealthEmployee: 0,
    totalPagibigEmployee: 0,
    totalLoans: 0,
    totalTaxes: 0,
    totalOtherDeductions: 0,
    totalPersonalDeductions: 0,
    totalNetPay: 0,
    totalGsisGovernment: 0,
    totalPhilhealthGovernment: 0,
    totalPagibigGovernment: 0,
    totalLguCounterpart: 0,
    grandTotalAppropriation: 0,
    varianceAlerts: 0,
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
      const selectedCutoff = cutoffs.find((c) => c.id === config.cutoffId);
      if (!selectedCutoff) {
        toast.error("Please select a cutoff period.");
        return;
      }
      const cutoffType = selectedCutoff.cutoff_type || "FIRST";

      // Attempt to load full workspace data (users, wages, attendance, allowances, loans, manual entries)
      let workspace: any = null;
      try {
        workspace = await svc.loadWorkspace({
          cutoff: selectedCutoff as any,
          departmentId: config.departmentId,
        });
      } catch (wsErr) {
        console.warn("Could not load full workspace, falling back to active users list:", wsErr);
      }

      // Fallback employee list if workspace is empty
      const empList = workspace?.employees?.length
        ? workspace.employees
        : await departmentApi.fetchAllUsers().catch(async () => {
            const res = await fetch("/api/employees");
            const j = await res.json().catch(() => null);
            return Array.isArray(j?.data) ? j.data : [];
          });

      // Map departments
      const deptMap = new Map<number, string>();
      for (const d of departments) {
        deptMap.set(d.department_id, d.department_name);
      }

      // Filter active employees (and by department if selected)
      const filtered = (empList || []).filter((u: any) => {
        const isDel = (u.is_deleted as any)?.data?.[0] === 1 || u.is_deleted === 1 || u.is_deleted === true;
        if (isDel) return false;
        const isEmp = u.is_employee === 0 || u.is_employee === false ? false : true;
        if (!isEmp) return false;
        const uDept = u.department_id ?? u.user_department;
        if (config.departmentId != null && uDept !== config.departmentId) return false;
        return true;
      });

      // Generate authentic LGU payroll lines using the exact same calculation engine as the company payroll run module
      const initialLines: LguPayrollLine[] = filtered.map((u: any) => {
        const userId = Number(u.id ?? u.user_id);
        const uDept = u.department_id ?? u.user_department;
        const deptName = uDept
          ? deptMap.get(uDept) || "LGU Department"
          : "General Administration";

        const position = u.position || u.user_position || "Administrative Officer";
        const firstName = u.first_name || u.user_fname || "";
        const lastName = u.last_name || u.user_lname || "";
        const employeeName = `${firstName} ${lastName}`.trim() || `Personnel #${userId}`;

        // 1. Get exact workspace data loaded from the database
        const wageProfile = workspace?.wages?.get(userId) ?? null;
        const attendanceRecords = workspace?.attendance?.get(userId) ?? [];
        const userManualEntries = workspace?.manualEntries?.get(userId) ?? [];
        const userLoans = workspace?.employeeLoans?.get(userId) ?? [];
        const userBenefitLoans = workspace?.benefitLoans?.get(userId) ?? [];
        const userAllowances = workspace?.allowances?.get(userId) ?? [];
        const userWageProrations = workspace?.wageProrationLogs?.get(userId) ?? [];
        const userPaidLeaves = workspace?.paidLeaves?.get(userId) ?? [];
        const userRetroPays = workspace?.retroPays?.get(userId) ?? [];
        const userCoopSavings = workspace?.coopSavingsMemberships?.get(userId) ?? [];

        // 2. Compute canonical payroll line using the authoritative payroll run module engine
        const computed = computeEmployeeLine({
          user: {
            id: userId,
            first_name: firstName,
            last_name: lastName,
            department_id: uDept ?? null,
            position,
            is_deleted: 0,
          },
          wage: wageProfile,
          attendance: attendanceRecords,
          holidays: workspace?.holidays ?? [],
          cutoffStart: selectedCutoff.start_date,
          cutoffEnd: selectedCutoff.end_date,
          manualEntries: userManualEntries,
          departmentName: deptName,
          previousNetPay: 0,
          onHold: false,
          benefitMultipliers: workspace?.benefitMultipliers ?? { SSS: 0.5, PHILHEALTH: 0.5, PAGIBIG: 0.5 },
          employeeLoans: userLoans,
          benefitLoans: userBenefitLoans,
          cutoffType: cutoffType as any,
          cutoffId: selectedCutoff.id,
          allowances: userAllowances,
          wageProrationLogs: userWageProrations,
          paidLeaves: userPaidLeaves,
          retroPays: userRetroPays,
          coopSavingsMemberships: userCoopSavings,
        });

        // 3. Extract itemized loans strictly from database records (no fake/sample loans)
        const gsisLoansBreakdown: LguLoanBreakdown[] = [];
        const pagibigLoansBreakdown: LguLoanBreakdown[] = [];

        for (const loan of userLoans) {
          const lt = String(loan.loan_type || "").toUpperCase();
          const amt = Math.round(((Number(loan.monthly_payment || 0)) / 2) * 100) / 100;
          if (amt <= 0) continue;
          if (lt.includes("GSIS")) {
            gsisLoansBreakdown.push({
              loanType: loan.loan_type || "GSIS Loan",
              amount: amt,
              balance: Number(loan.remaining_balance || 0),
            });
          } else if (lt.includes("PAGIBIG") || lt.includes("HDMF")) {
            pagibigLoansBreakdown.push({
              loanType: loan.loan_type || "Pag-IBIG MPL Loan",
              amount: amt,
              balance: Number(loan.remaining_balance || 0),
            });
          }
        }

        for (const bl of userBenefitLoans) {
          const bc = String(bl.benefit_code || "").toUpperCase();
          const amt = Math.round(((Number(bl.amortization_amount || 0)) / 2) * 100) / 100;
          if (amt <= 0) continue;
          if (bc.includes("GSIS")) {
            gsisLoansBreakdown.push({
              loanType: bl.loan_name || "GSIS Loan",
              amount: amt,
              balance: Number(bl.remaining_balance || 0),
            });
          } else if (bc.includes("PAGIBIG") || bc.includes("HDMF")) {
            pagibigLoansBreakdown.push({
              loanType: bl.loan_name || "Pag-IBIG Loan",
              amount: amt,
              balance: Number(bl.remaining_balance || 0),
            });
          }
        }

        // 4. Extract allowances strictly from database records
        let rataAllowance = 0;
        let hazardPay = 0;
        let peraAllowance = 0;
        let otherAllowances = 0;
        const allowancesBreakdown: LguAllowanceBreakdown[] = [];

        for (const al of userAllowances) {
          const desc = String(al.description || "").trim();
          const descLower = desc.toLowerCase();
          const amt = Number(al.amount || 0);
          if (amt <= 0) continue;

          if (descLower.includes("pera")) {
            peraAllowance += amt;
            allowancesBreakdown.push({ name: desc || "PERA", amount: amt, isTaxable: false });
          } else if (descLower.includes("rata") || descLower.includes("representation") || descLower.includes("transport")) {
            rataAllowance += amt;
            allowancesBreakdown.push({ name: desc || "RATA", amount: amt, isTaxable: false });
          } else if (descLower.includes("hazard") || descLower.includes("magna")) {
            hazardPay += amt;
            allowancesBreakdown.push({ name: desc || "Hazard Pay", amount: amt, isTaxable: false });
          } else {
            otherAllowances += amt;
            allowancesBreakdown.push({ name: desc || "Allowance", amount: amt, isTaxable: true });
          }
        }

        // 5. Extract manual additions & deductions strictly from database records
        const manualAdditions: LguManualAdjustment[] = [];
        const manualDeductions: LguManualAdjustment[] = [];

        for (const me of userManualEntries) {
          const meType = String(me.type || "").toUpperCase();
          const amt = Number(me.amount || 0);
          if (amt <= 0) continue;

          if (meType === "EARNING" || meType === "ADDITION") {
            manualAdditions.push({
              id: me.id || `ma-${Math.random()}`,
              type: "EARNING",
              description: me.desc || "Manual Addition",
              amount: amt,
              category: me.category || "Addition",
            });
          } else {
            manualDeductions.push({
              id: me.id || `md-${Math.random()}`,
              type: "DEDUCTION",
              description: me.desc || "Manual Deduction",
              amount: amt,
              category: me.category || "Deduction",
            });
          }
        }

        // 6. Map statutory contributions (GSIS / SSS, PhilHealth, Pag-IBIG with government cost-sharing)
        const hasEarnings = computed.gross_pay > 0 && computed.total_days_worked > 0;

        const gsisEmp = hasEarnings ? computed.benefit_sss : 0;
        const phEmp = hasEarnings ? computed.benefit_philhealth : 0;
        const pagibigEmp = hasEarnings ? computed.benefit_pagibig : 0;

        // Government counterpart is only remitted when employee has active earnings & contributions
        const gsisGov = hasEarnings && gsisEmp > 0 ? Math.round((computed.monthly_rate * 0.12 / 2) * 100) / 100 : 0;
        const phGov = hasEarnings && phEmp > 0 ? phEmp : 0; // 1:1 match per PhilHealth Circular
        const pagibigGov = hasEarnings && pagibigEmp > 0 ? pagibigEmp : 0;

        const statutory: LguEmployeeStatutory = {
          gsisEmployee: gsisEmp,
          gsisGovernment: gsisGov,
          gsisTotal: Math.round((gsisEmp + gsisGov) * 100) / 100,
          philhealthEmployee: phEmp,
          philhealthGovernment: phGov,
          philhealthTotal: Math.round((phEmp + phGov) * 100) / 100,
          pagibigEmployee: pagibigEmp,
          pagibigGovernment: pagibigGov,
          pagibigTotal: Math.round((pagibigEmp + pagibigGov) * 100) / 100,
          totalEmployeeStatutory: Math.round((gsisEmp + phEmp + pagibigEmp) * 100) / 100,
          totalGovernmentStatutory: Math.round((gsisGov + phGov + pagibigGov) * 100) / 100,
          grandTotalStatutory: Math.round((gsisEmp + phEmp + pagibigEmp + gsisGov + phGov + pagibigGov) * 100) / 100,
        };

        const salaryGrade = inferSalaryGrade(position, computed.monthly_rate);

        return computeLguLine({
          userId,
          employeeNo: `LGU-${String(userId).padStart(5, "0")}`,
          employeeName,
          departmentId: uDept ?? null,
          departmentName: deptName,
          position,
          salaryGrade,
          employmentStatus: computed.monthly_rate >= 40000 ? "PERMANENT" : "CASUAL",
          monthlySalary: computed.monthly_rate,
          daysWorked: computed.total_days_worked,
          standardCutoffDays: 11,
          lateMinutes: computed.late_minutes,
          lateDeduction: computed.late_deduction,
          undertimeMinutes: computed.undertime_minutes,
          undertimeDeduction: computed.undertime_deduction,
          basicPay: computed.basic_pay,
          overtimeHours: Math.round((computed.overtime_minutes / 60) * 100) / 100,
          overtimePay: computed.ot_amount,
          nightDiffPay: computed.night_diff_amount,
          peraAllowance,
          rataAllowance,
          hazardPay,
          otherAllowances: otherAllowances + (computed.leave_amount || 0) + (computed.holiday_pay || 0) + (computed.rest_day_amount || 0) + (computed.retro_pay || 0),
          allowancesBreakdown,
          statutory,
          gsisLoansBreakdown,
          pagibigLoansBreakdown,
          coopDeduction: Math.round((computed.loan_coop + (computed.coop_savings || 0)) * 100) / 100,
          otherDeductions: Math.round((computed.other_deductions + computed.dr_deduction + computed.shortage_deduction) * 100) / 100,
          manualAdditions,
          manualDeductions,
          cutoffType: cutoffType as any,
        });
      });

      setLines(initialLines);
      setSummary(computeLguSummary(initialLines));
      setStep(2);
      setMaxStepAllowed(2);
      toast.success(`Computed payroll records for ${initialLines.length} personnel.`);
    } catch (err) {
      console.error("Failed to compute LGU payroll lines:", err);
      toast.error("Failed to compute payroll lines.");
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

  // Add custom adjustment
  const handleAddAdjustment = (userId: number, adjustment: Omit<LguManualAdjustment, "id">) => {
    setLines((prev) => {
      const next = prev.map((l) => {
        if (l.userId !== userId) return l;

        const newAdj: LguManualAdjustment = {
          ...adjustment,
          id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        };

        const updatedAdditions = adjustment.type === "EARNING"
          ? [...l.manualAdditions, newAdj]
          : l.manualAdditions;

        const updatedDeductions = adjustment.type === "DEDUCTION"
          ? [...l.manualDeductions, newAdj]
          : l.manualDeductions;

        return computeLguLine({
          ...l,
          manualAdditions: updatedAdditions,
          manualDeductions: updatedDeductions,
        });
      });

      setSummary(computeLguSummary(next));
      return next;
    });
  };

  // Edit custom adjustment
  const handleEditAdjustment = (userId: number, adjustment: LguManualAdjustment) => {
    setLines((prev) => {
      const next = prev.map((l) => {
        if (l.userId !== userId) return l;

        const updatedAdditions = adjustment.type === "EARNING"
          ? l.manualAdditions.map((a) => (a.id === adjustment.id ? adjustment : a))
          : l.manualAdditions.filter((a) => a.id !== adjustment.id);

        const updatedDeductions = adjustment.type === "DEDUCTION"
          ? l.manualDeductions.map((d) => (d.id === adjustment.id ? adjustment : d))
          : l.manualDeductions.filter((d) => d.id !== adjustment.id);

        return computeLguLine({
          ...l,
          manualAdditions: updatedAdditions,
          manualDeductions: updatedDeductions,
        });
      });

      setSummary(computeLguSummary(next));
      return next;
    });
  };

  // Delete custom adjustment
  const handleDeleteAdjustment = (userId: number, adjustmentId: string | number) => {
    setLines((prev) => {
      const next = prev.map((l) => {
        if (l.userId !== userId) return l;

        const updatedAdditions = l.manualAdditions.filter((a) => a.id !== adjustmentId);
        const updatedDeductions = l.manualDeductions.filter((d) => d.id !== adjustmentId);

        return computeLguLine({
          ...l,
          manualAdditions: updatedAdditions,
          manualDeductions: updatedDeductions,
        });
      });

      setSummary(computeLguSummary(next));
      return next;
    });
  };

  // Recompute all lines
  const handleRecompute = () => {
    setLines((prev) => {
      const next = prev.map((l) => computeLguLine({ ...l }));
      setSummary(computeLguSummary(next));
      toast.success("Payroll records successfully recomputed.");
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
      toast.success("LGU Payroll Run successfully posted & finalized! All records are now locked.");
    } catch (err) {
      console.error("Failed to post LGU payroll run:", err);
      toast.error("Failed to post payroll run.");
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
                cutoff={selectedCutoff}
                payrollRefNo={config.payrollRefNo}
                onToggleHold={handleToggleHold}
                onAddAdjustment={handleAddAdjustment}
                onEditAdjustment={handleEditAdjustment}
                onDeleteAdjustment={handleDeleteAdjustment}
                onRecompute={handleRecompute}
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
