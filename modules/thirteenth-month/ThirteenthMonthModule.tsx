// modules/thirteenth-month/ThirteenthMonthModule.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  ThirteenthMonthHeader,
  ThirteenthMonthEmployeeLine,
  ThirteenthMonthSummary,
  EmployeeManualAdjustment,
} from "./types";
import {
  loadThirteenthMonthWorkspace,
  computeEmployeeLines,
  calculateWorkingDaysInRange,
  WorkspaceData,
} from "./providers/thirteenthMonthService";
import {
  fetch13thMonthConfig,
  save13thMonthConfig,
  fetch13thMonthAdjustments,
  save13thMonthAdjustments,
} from "./providers/thirteenthMonthApi";
import { ThirteenthMonthHeaderCard } from "./components/ThirteenthMonthHeaderCard";
import { ThirteenthMonthTable } from "./components/ThirteenthMonthTable";
import { CreateHeaderModal } from "./components/CreateHeaderModal";
import { DaysCalculationDetailModal } from "./components/DaysCalculationDetailModal";

const currentYear = new Date().getFullYear();
const defaultStartDate = `${currentYear}-01-01`;
const defaultEndDate = `${currentYear}-11-30`;
const initialWorkingDays = calculateWorkingDaysInRange(defaultStartDate, defaultEndDate);

const initialHeader: ThirteenthMonthHeader = {
  id: "batch-current",
  batch_number: `13TH-${currentYear}-01`,
  title: `${currentYear} Year-End 13th Month Pay`,
  year: currentYear,
  start_date: defaultStartDate,
  end_date: defaultEndDate,
  total_period_working_days: initialWorkingDays || 240,
  status: "CALCULATED",
  department_filter: "ALL",
  notes: "Automatic calculation based on period working days and actual days worked",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

interface ThirteenthMonthModuleProps {
  initialUserId?: string | number;
}

export default function ThirteenthMonthModule({ initialUserId }: ThirteenthMonthModuleProps = {}) {
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);

  const [header, setHeader] = useState<ThirteenthMonthHeader>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("13th_month_header_config");
        if (saved) {
          return { ...initialHeader, ...JSON.parse(saved) };
        }
      } catch {}
    }
    return initialHeader;
  });
  const [manualAdjustments, setManualAdjustments] = useState<
    Record<number, EmployeeManualAdjustment>
  >(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`13th_month_adjustments_${currentYear}`);
        return saved ? JSON.parse(saved) : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  const [lines, setLines] = useState<ThirteenthMonthEmployeeLine[]>([]);
  const [summary, setSummary] = useState<ThirteenthMonthSummary>({
    total_employees: 0,
    active_employees: 0,
    on_hold_employees: 0,
    total_working_days: initialWorkingDays || 240,
    total_gross_13th_month: 0,
    total_advances: 0,
    total_tax_withheld: 0,
    total_net_payout: 0,
    average_payout: 0,
  });

  // Modals state
  const [headerModalOpen, setHeaderModalOpen] = useState(false);
  const [detailModalLine, setDetailModalLine] = useState<ThirteenthMonthEmployeeLine | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // 1. Initial Data Fetch
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const ws = await loadThirteenthMonthWorkspace();
        setWorkspace(ws);

        // Fetch enterprise-saved configuration & adjustments
        let activeHeader = header;
        try {
          const savedServer = await fetch13thMonthConfig();
          if (savedServer) {
            activeHeader = { ...initialHeader, ...savedServer };
            setHeader(activeHeader);
            if (typeof window !== "undefined") {
              localStorage.setItem("13th_month_header_config", JSON.stringify(activeHeader));
            }
          }
        } catch (e) {
          console.warn("Could not retrieve remote 13th month configuration:", e);
        }

        let activeAdjustments = manualAdjustments;
        try {
          const serverAdjustments = await fetch13thMonthAdjustments(activeHeader.year);
          if (serverAdjustments) {
            activeAdjustments = { ...manualAdjustments, ...serverAdjustments };
            setManualAdjustments(activeAdjustments);
            if (typeof window !== "undefined") {
              localStorage.setItem(`13th_month_adjustments_${activeHeader.year}`, JSON.stringify(activeAdjustments));
            }
          }
        } catch (e) {
          console.warn("Could not retrieve remote 13th month adjustments:", e);
        }

        const { lines: computedLines, summary: computedSummary } = computeEmployeeLines(
          activeHeader,
          ws,
          activeAdjustments
        );
        setLines(computedLines);
        setSummary(computedSummary);

        if (initialUserId) {
          const target = computedLines.find((l) => String(l.user_id) === String(initialUserId));
          if (target) {
            setDetailModalLine(target);
            setDetailModalOpen(true);
          }
        }
      } catch (err: any) {
        console.error("Error loading 13th month workspace:", err);
        toast.error(err.message || "Failed to load 13th month payroll data.");
      } finally {
        setLoading(false);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Recalculation Handler
  const runCalculation = useCallback(
    (curHeader: ThirteenthMonthHeader, curAdjustments = manualAdjustments) => {
      if (!workspace) return;
      setRecalculating(true);
      try {
        const { lines: computedLines, summary: computedSummary } = computeEmployeeLines(
          curHeader,
          workspace,
          curAdjustments
        );
        setLines(computedLines);
        setSummary(computedSummary);
      } catch (err: any) {
        toast.error("Failed to recalculate 13th month pay.");
      } finally {
        setRecalculating(false);
      }
    },
    [workspace, manualAdjustments]
  );

  const handleManualRecalculate = () => {
    runCalculation(header);
    toast.success("13th Month pay recalculated successfully!");
  };

  // 3. Save Header
  const handleSaveHeader = async (newHeader: ThirteenthMonthHeader) => {
    setHeader(newHeader);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("13th_month_header_config", JSON.stringify(newHeader));
      } catch {}
    }
    runCalculation(newHeader);

    try {
      const ok = await save13thMonthConfig(newHeader);
      if (ok) {
        toast.success("13th Month configuration saved successfully!");
      } else {
        toast.info("Configuration saved locally (offline mode).");
      }
    } catch (err: any) {
      console.error("Failed to save header configuration:", err);
      toast.error("Failed to save configuration to database.");
    }
  };


  // 4. Save Adjustment for Individual Employee
  const handleSaveAdjustment = (
    userId: number,
    data: EmployeeManualAdjustment
  ) => {
    const updated = {
      ...manualAdjustments,
      [userId]: data,
    };
    setManualAdjustments(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`13th_month_adjustments_${header.year}`, JSON.stringify(updated));
      } catch {}
    }
    runCalculation(header, updated);

    // Persist to database asynchronously
    save13thMonthAdjustments(header.year, updated).catch((err) => {
      console.warn("Could not sync adjustments to server:", err);
    });

    // Update modal line reference if open
    setDetailModalLine((prev) => {
      if (!prev || prev.user_id !== userId || !workspace) return prev;
      const { lines: recalculated } = computeEmployeeLines(header, workspace, updated);
      return recalculated.find((l) => l.user_id === userId) || prev;
    });
  };

  // 5. Toggle Hold
  const handleToggleHold = (userId: number, currentHold: boolean) => {
    const current = manualAdjustments[userId] || {};
    const updated = {
      ...manualAdjustments,
      [userId]: {
        ...current,
        on_hold: !currentHold,
      },
    };
    setManualAdjustments(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`13th_month_adjustments_${header.year}`, JSON.stringify(updated));
      } catch {}
    }
    runCalculation(header, updated);

    // Persist to database asynchronously
    save13thMonthAdjustments(header.year, updated).catch((err) => {
      console.warn("Could not sync hold state to server:", err);
    });

    toast.info(`Employee #${userId} ${!currentHold ? "placed on hold" : "released from hold"}.`);
  };

  // 6. Open Detail Modal
  const handleOpenDetail = (line: ThirteenthMonthEmployeeLine) => {
    setDetailModalLine(line);
    setDetailModalOpen(true);
  };

  // 7. CSV Export
  const handleExportCsv = () => {
    if (lines.length === 0) {
      toast.error("No data to export.");
      return;
    }

    const months = lines[0]?.monthly_breakdown || [];
    const monthHeaders = months.map((m) => `"${m.month_short} Days (${m.total_working_days}d)"`);

    const headers = [
      "User ID",
      "Employee Name",
      "Department",
      "Position",
      "Monthly Salary",
      "Period Working Days",
      "Pay Per Day",
      ...monthHeaders,
      "Total Days Worked",
      "Adjustment Days",
      "Effective Days Worked",
      "13th Month Gross",
      "Mid-Year Advance",
      "Tax Withheld",
      "Net 13th Month Pay",
      "Payment Mode",
      "Status",
    ];

    const rows = lines.map((l) => {
      const monthVals = (l.monthly_breakdown || []).map((m) => m.days_worked.toFixed(2));
      return [
        l.user_id,
        `"${l.employee_name.replace(/"/g, '""')}"`,
        `"${l.department_name.replace(/"/g, '""')}"`,
        `"${l.position.replace(/"/g, '""')}"`,
        l.monthly_salary.toFixed(2),
        l.period_working_days,
        l.pay_per_day.toFixed(2),
        ...monthVals,
        l.actual_days_worked.toFixed(2),
        l.adjustment_days.toFixed(2),
        l.effective_days_worked.toFixed(2),
        l.computed_13th_month.toFixed(2),
        l.advance_deduction.toFixed(2),
        l.tax_withheld.toFixed(2),
        l.net_13th_month.toFixed(2),
        l.payment_method,
        l.on_hold ? "ON_HOLD" : "ACTIVE",
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `13th_Month_Payroll_${header.year}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV Export downloaded successfully!");
  };

  const departmentsList: { id: string | number; name: string }[] = (workspace?.departments || []).map((d) => ({
    id: (d.department_id != null ? (d.department_id as string | number) : (d.id != null ? (d.id as string | number) : "")),
    name: String(d.department_name || d.name || `Dept #${d.id}`),
  }));

  return (
    <DashboardLayout>
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-primary/15 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse" />
        <div className="absolute top-[20%] right-[-10%] w-[35%] h-[35%] rounded-full bg-emerald-500/15 blur-[100px] mix-blend-multiply dark:mix-blend-screen" />
      </div>

      <div className="relative z-10 w-full max-w-[1600px] mx-auto space-y-6 pb-12">
        {/* Page Title */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-1"
        >
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
            13th Month Pay Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Calculate, audit, and disburse 13th month compensation based on period working days, pay per day, and actual employee attendance.
          </p>
        </motion.div>

        {loading ? (
          <div className="space-y-6">
            <Card className="p-6 rounded-2xl bg-card/60 backdrop-blur-md">
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-10 w-80" />
                <div className="grid grid-cols-4 gap-4 pt-4">
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                </div>
              </div>
            </Card>
            <Card className="p-6 rounded-2xl bg-card/60">
              <Skeleton className="h-80 w-full" />
            </Card>
          </div>
        ) : (
          <>
            {/* Header Component */}
            <ThirteenthMonthHeaderCard
              header={header}
              summary={summary}
              onEditHeader={() => setHeaderModalOpen(true)}
              onRecalculate={handleManualRecalculate}
              isRecalculating={recalculating}
            />

            {/* Employee Calculation Table Component */}
            <ThirteenthMonthTable
              lines={lines}
              departments={departmentsList}
              onOpenDetail={handleOpenDetail}
              onToggleHold={handleToggleHold}
              onExportCsv={handleExportCsv}
            />
          </>
        )}
      </div>

      {/* Header Config Modal */}
      <CreateHeaderModal
        open={headerModalOpen}
        onOpenChange={setHeaderModalOpen}
        initialHeader={header}
        onSaveHeader={handleSaveHeader}
        departments={departmentsList}
      />

      {/* Individual Employee Days Calculation Details Modal */}
      <DaysCalculationDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        line={detailModalLine}
        onSaveAdjustment={handleSaveAdjustment}
      />
    </DashboardLayout>
  );
}
