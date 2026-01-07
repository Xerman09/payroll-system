"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { EmployeeRow, PayrollConfigState, PayrollStep } from "./types";
import {
  payrollCutoffs,
  payrollDepartments,
  initialEmployees,
  salaryHistory,
} from "./providers/mockData";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { PayrollStepper } from "./components/PayrollStepper";
import { PayrollConfigStep } from "./components/PayrollConfigStep";
import { PayrollAdjustStep } from "./components/PayrollAdjustStep";
import { PayrollProcessStep } from "./components/PayrollProcessStep";
import { PayrollReviewStep } from "./components/PayrollReviewStep";
import { AdjustmentModal } from "./components/AdjustmentModal";
import { computePayrollRegister, parseCutoffValue } from "./utils/payroll";

import { Card } from "@/components/ui/card";

const DEFAULT_CONFIG: PayrollConfigState = {
  cutoffValue: payrollCutoffs[0]?.value ?? "",
  departmentValue: "ALL",
};

export default function PayrollRunModule() {
  const [step, setStep] = useState<PayrollStep>(1);
  const [config, setConfig] = useState<PayrollConfigState>(DEFAULT_CONFIG);
  const [employees, setEmployees] = useState<EmployeeRow[]>(initialEmployees);

  const [modalOpen, setModalOpen] = useState(false);
  const [activeEmployeeId, setActiveEmployeeId] = useState<number | null>(null);

  const activeEmployee = useMemo(() => {
    if (activeEmployeeId == null) return null;
    return employees.find((e) => e.id === activeEmployeeId) ?? null;
  }, [activeEmployeeId, employees]);

  const filteredEmployees = useMemo(() => {
    if (config.departmentValue === "ALL") return employees;
    return employees.filter((e) => e.department === config.departmentValue);
  }, [employees, config.departmentValue]);

  const cutoff = useMemo(
    () => parseCutoffValue(config.cutoffValue),
    [config.cutoffValue]
  );

  const register = useMemo(() => {
    if (!cutoff.start || !cutoff.end) {
      return {
        rows: [],
        summary: { totalNet: 0, activeHeadcount: 0, varianceAlerts: 0 },
      };
    }

    return computePayrollRegister(
      filteredEmployees,
      cutoff.start,
      cutoff.end,
      salaryHistory,
      { fixedDeductions: 2000 }
    );
  }, [cutoff.start, cutoff.end, filteredEmployees]);

  useEffect(() => {
    if (step !== 3) return;
    const t = setTimeout(() => setStep(4), 1500);
    return () => clearTimeout(t);
  }, [step]);

  function navTo(next: PayrollStep) {
    setStep(next);
  }

  function toggleHold(employeeId: number) {
    setEmployees((prev) =>
      prev.map((e) => (e.id === employeeId ? { ...e, onHold: !e.onHold } : e))
    );
  }

  function openAdjustment(employeeId: number) {
    setActiveEmployeeId(employeeId);
    setModalOpen(true);
  }

  function saveAdjustment(
    employeeId: number,
    adjustment: EmployeeRow["adjustments"][number]
  ) {
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === employeeId
          ? { ...e, adjustments: [...e.adjustments, adjustment] }
          : e
      )
    );
  }

  function startOver() {
    setConfig(DEFAULT_CONFIG);
    setEmployees(initialEmployees);
    setActiveEmployeeId(null);
    setModalOpen(false);
    setStep(1);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header like your COOP module */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Payroll Run Manager
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate, Adjust, and Validate Employee Payroll
            </p>
          </div>
        </div>

        {/* Stepper inside a normal page card (not a banner card) */}
        <Card className="p-6">
          <PayrollStepper activeStep={step} />
        </Card>

        {step === 1 ? (
          <PayrollConfigStep
            config={config}
            cutoffs={payrollCutoffs}
            departments={payrollDepartments}
            onChange={(patch) => setConfig((c) => ({ ...c, ...patch }))}
            onNext={() => navTo(2)}
          />
        ) : null}

        {step === 2 ? (
          <PayrollAdjustStep
            employees={filteredEmployees}
            onToggleHold={toggleHold}
            onOpenAdjustment={openAdjustment}
            onNext={() => navTo(3)}
          />
        ) : null}

        {step === 3 ? <PayrollProcessStep /> : null}

        {step === 4 ? (
          <PayrollReviewStep
            rows={register.rows}
            summary={register.summary}
            onBackToAdjust={() => navTo(2)}
            onStartOver={startOver}
          />
        ) : null}

        <Card className="p-4 text-sm text-muted-foreground">
          Prototype parity notes:
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Base pay uses semi-monthly assumption (basic/2) unless a salary
              change falls within the cutoff.
            </li>
            <li>Fixed deductions are mocked at ₱2,000 per employee.</li>
            <li>Processing step is a simulated delay (1.5s) before Review.</li>
          </ul>
        </Card>

        <AdjustmentModal
          open={modalOpen}
          employee={activeEmployee}
          onOpenChange={setModalOpen}
          onSave={saveAdjustment}
        />
      </div>
    </DashboardLayout>
  );
}
