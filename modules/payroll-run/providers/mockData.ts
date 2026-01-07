import type {
  EmployeeRow,
  PayrollCutoffOption,
  PayrollDepartmentOption,
  SalaryHistoryEntry,
} from "../types";

export const payrollCutoffs: PayrollCutoffOption[] = [
  {
    value: "2025-11-26_2025-12-10",
    label: "Nov 26, 2025 - Dec 10, 2025 (2nd Cutoff)",
  },
  {
    value: "2025-12-11_2025-12-25",
    label: "Dec 11, 2025 - Dec 25, 2025 (1st Cutoff)",
  },
];

export const payrollDepartments: PayrollDepartmentOption[] = [
  { value: "ALL", label: "All Departments" },
  { value: "IT", label: "IT Department" },
  { value: "HR", label: "Human Resources" },
];

export const initialEmployees: EmployeeRow[] = [
  {
    id: 1,
    name: "Erman Ace M. Cerujano",
    position: "Senior Dev",
    department: "IT",
    basic: 25000,
    previousNet: 22000,
    onHold: false,
    adjustments: [],
  },
  {
    id: 2,
    name: "Andrei Jam Siapno",
    position: "System Dev",
    department: "IT",
    basic: 30000,
    previousNet: 18500,
    onHold: false,
    adjustments: [],
  },
  {
    id: 3,
    name: "Zarina Carcha",
    position: "HR Manager",
    department: "HR",
    basic: 30000,
    previousNet: 28000,
    onHold: false,
    adjustments: [],
  },
  {
    id: 4,
    name: "New Hire (Prorated)",
    position: "Junior Dev",
    department: "IT",
    basic: 15000,
    previousNet: 0,
    onHold: false,
    adjustments: [
      { type: "EARNING", desc: "Signing Bonus", amount: 5000, recurring: false },
    ],
  },
];

export const salaryHistory: SalaryHistoryEntry[] = [
  {
    user_id: 2, // Andrei Jam Siapno
    old_basic: 20000.0,
    new_basic: 30000.0,
    effective_date: "2025-12-01",
  },
];
