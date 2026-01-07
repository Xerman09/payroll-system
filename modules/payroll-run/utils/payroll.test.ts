import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateProratedPay,
  computeEmployeePayroll,
  computePayrollRegister,
  formatPHP,
  parseCutoffValue,
  sumAdjustments,
} from "./payroll";

import type { EmployeeRow, SalaryHistoryEntry } from "../types";

test("parseCutoffValue: splits start and end", () => {
  const r = parseCutoffValue("2025-11-26_2025-12-10");
  assert.equal(r.start, "2025-11-26");
  assert.equal(r.end, "2025-12-10");
});

test("formatPHP: returns a PHP currency string", () => {
  const s = formatPHP(1234.5);
  // Locale formatting can vary slightly, but must include currency symbol and digits.
  assert.ok(s.includes("₱"));
  assert.ok(s.includes("1,234") || s.includes("1234"));
});

test("sumAdjustments: aggregates earnings and deductions; ignores invalid amounts", () => {
  const r = sumAdjustments([
    { type: "EARNING", desc: "A", amount: 100 },
    { type: "DEDUCTION", desc: "B", amount: 50 },
    { type: "EARNING", desc: "C", amount: -1 }, // ignored
    { type: "DEDUCTION", desc: "D", amount: Number.NaN }, // ignored
  ]);

  assert.equal(r.earnings, 100);
  assert.equal(r.deductions, 50);
});

test("calculateProratedPay: no salary change => semi-monthly basic/2", () => {
  const employee = { id: 1, basic: 20000 };
  const hist: SalaryHistoryEntry[] = [];
  const r = calculateProratedPay(employee, "2025-11-26", "2025-12-10", hist);
  assert.equal(r.isProrated, false);
  assert.equal(r.amount, 10000);
});

test("calculateProratedPay: salary change within cutoff => prorated amount and details", () => {
  const employee = { id: 2, basic: 30000 };
  const hist: SalaryHistoryEntry[] = [
    {
      user_id: 2,
      old_basic: 20000,
      new_basic: 30000,
      effective_date: "2025-12-01",
    },
  ];

  const r = calculateProratedPay(employee, "2025-11-26", "2025-12-10", hist);

  assert.equal(r.isProrated, true);
  assert.ok(r.amount > 0);
  assert.ok(r.details);
  assert.equal(r.details?.daysOnOldRate + r.details?.daysOnNewRate, 11);
  assert.equal(r.details?.oldBasic, 20000);
  assert.equal(r.details?.newBasic, 30000);
});

test("computeEmployeePayroll: respects hold flag", () => {
  const emp: EmployeeRow = {
    id: 1,
    name: "A",
    position: "X",
    department: "IT",
    basic: 20000,
    previousNet: 10000,
    onHold: true,
    adjustments: [],
  };

  const row = computeEmployeePayroll(emp, "2025-11-26", "2025-12-10", [], {
    fixedDeductions: 2000,
  });

  assert.equal(row, null);
});

test("computeEmployeePayroll: computes gross, deductions, net, variance", () => {
  const emp: EmployeeRow = {
    id: 1,
    name: "A",
    position: "X",
    department: "IT",
    basic: 20000,
    previousNet: 8000,
    onHold: false,
    adjustments: [
      { type: "EARNING", desc: "bonus", amount: 1000 },
      { type: "DEDUCTION", desc: "late", amount: 200 },
    ],
  };

  const row = computeEmployeePayroll(emp, "2025-11-26", "2025-12-10", [], {
    fixedDeductions: 2000,
  });

  assert.ok(row);
  // basic/2 = 10000; gross = 10000 + 1000 = 11000
  assert.equal(row!.gross, 11000);
  // deductions = 2000 + 200 = 2200
  assert.equal(row!.deductions, 2200);
  // net = 8800
  assert.equal(row!.net, 8800);
  // variancePct = (8800 - 8000)/8000 * 100 = 10
  assert.ok(row!.variancePct !== null);
  assert.ok(Math.abs(row!.variancePct! - 10) < 1e-9);
  assert.equal(row!.varianceAlert, false);
});

test("computePayrollRegister: aggregates rows and summary", () => {
  const employees: EmployeeRow[] = [
    {
      id: 1,
      name: "A",
      position: "X",
      department: "IT",
      basic: 20000,
      previousNet: 0,
      onHold: false,
      adjustments: [],
    },
    {
      id: 2,
      name: "B",
      position: "Y",
      department: "HR",
      basic: 20000,
      previousNet: 0,
      onHold: true,
      adjustments: [],
    },
  ];

  const r = computePayrollRegister(employees, "2025-11-26", "2025-12-10", [], {
    fixedDeductions: 2000,
  });

  assert.equal(r.rows.length, 1);
  assert.equal(r.summary.activeHeadcount, 1);
  // net = 10000 - 2000 = 8000
  assert.equal(r.summary.totalNet, 8000);
});
