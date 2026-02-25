---
description: Analysis of Wage Module Benefits Tab Logic, Flow, and DDLs
---

# Wage Module - Benefits Tab Analysis

## 1. Logic and Flow Analysis

### Overview
The "Benefits" tab is part of the **Employee Compensation Modal** within the Wage Module. It is designed to manage:
1.  **Statutory Contributions**: SSS, PhilHealth, and Pag-IBIG monthly contributions.
2.  **Benefit Loans**: Tracking loans from these benefit agencies (e.g., SSS Salary Loan, Pag-IBIG Multi-Purpose Loan).

### Component Hierarchy
1.  `WageModule.tsx` (Parent Page)
    -   Fetches employee list.
    -   Fetches main wage data (`user_wage_management`) via `loadWageData`.
    -   Passes `wageData` state to `WageModal`.
2.  `WageModal.tsx` (Container)
    -   Manages the tabs state.
    -   Passes `wageData` and API handlers to `BenefitsTab`.
3.  `BenefitsTab.tsx` (UI Implementation)
    -   **Section 1: Contributions**
        -   Displays inputs for SSS, Pagibig, and Philhealth.
        -   Directly updates the `wageData` state in the parent `WageModule`.
        -   **Persistence**: These values are saved ONLY when the user clicks the main "Save" button in the `WageModal` footer, which triggers `WageModule.saveWageData`.
    -   **Section 2: Benefit Loans**
        -   Displays a table of Benefit Loans (`benefit_loans`).
        -   **Fetching**: Calls `wageApi.fetchBenefitLoansByUser` on mount or user change.
        -   **CRUD Operations**:
            -   **Create/Edit**: Opens a local dialog (`formOpen`). Validates inputs (benefit code, positive amounts, valid cutoff). Calls `wageApi.createBenefitLoan` or `wageApi.patchBenefitLoan` immediately (independent of the main Wage save).
            -   **Delete**: Calls `wageApi.deleteBenefitLoan`.
            -   **Auto-Computation**: The UI auto-calculates `Interest`, `Total Payable`, `Amortization`, and `Remaining Balance` based on Principal, Interest Rate %, and Terms.

### Data Dependencies
-   **User Wage Management**: Source of contribution data.
-   **Benefit Loans**: Source of loan records.
-   **Cutoff Settings**: Used to select the `start_cutoff_id` implies when the loan deduction begins.

---

## 2. Recorded DDLs (Inferred)

Based on the TypeScript interfaces and API usage, here are the Data Definition Language (DDL) schemas for the tables used in this tab. Note that `directus` auto-manages some system fields, but these are the logical schemas.

### A. user_wage_management
Stores the main compensation details including statutory contributions.

```sql
CREATE TABLE user_wage_management (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,                    -- Foreign Key to user table
  
  -- Compensation
  daily_wage DECIMAL(10, 2),
  
  -- Leaves
  vacation_leave_per_year DECIMAL(10, 2),
  sick_leave_per_year DECIMAL(10, 2),
  
  -- Flags
  paid_holiday TINYINT(1) DEFAULT 0,       -- Boolean: 0 or 1
  isCard TINYINT(1) DEFAULT 0,             -- Boolean: 0 or 1
  
  -- Statutory Contributions (Managed in Benefits Tab)
  sss_contribution_monthly DECIMAL(10, 2),
  pagibig_contribution_monthly DECIMAL(10, 2),
  philhealth_contribution_monthly DECIMAL(10, 2),
  
  -- Metadata
  cutoff_wage_date_update DATE,            -- Tracks effective date of wage change
  created_by INT,
  created_date DATETIME,
  updated_by INT,
  updated_date DATETIME
);
```

### B. benefit_loans
Stores individual loan records associated with benefits (SSS/Pagibig).

```sql
CREATE TABLE benefit_loans (
  loan_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,                    -- Foreign Key to user table
  
  -- Loan Details
  benefit_code VARCHAR(20) NOT NULL,       -- Enum: 'SSS', 'PAGIBIG'
  loan_name VARCHAR(255),
  reference_no VARCHAR(100),
  
  -- Financials
  principal_amount DECIMAL(10, 2) NOT NULL,
  interest_amount DECIMAL(10, 2) NOT NULL,
  total_payable DECIMAL(10, 2) NOT NULL,   -- principal + interest
  amortization_amount DECIMAL(10, 2) NOT NULL,
  accumulated_amount DECIMAL(10, 2) DEFAULT 0,
  remaining_balance DECIMAL(10, 2) NOT NULL,
  paid_installments INT DEFAULT 0,
  
  -- Schedule
  terms_installments INT NOT NULL,
  deduct_on VARCHAR(10) NOT NULL,          -- Enum: 'FIRST', 'SECOND', 'BOTH'
  start_cutoff_id INT NOT NULL,            -- Foreign Key to cutoff_settings
  last_paid_cutoff_id INT,                 -- Foreign Key to cutoff_settings
  
  -- Status
  status VARCHAR(20) DEFAULT 'ACTIVE',     -- Enum: 'ACTIVE', 'CLOSED', 'CANCELLED'
  remarks TEXT,
  
  -- Metadata
  created_by INT,
  created_date DATETIME,
  updated_by INT,
  updated_date DATETIME
);

### C. benefit_logs
Stores history of benefit contributions and loan deductions.

```sql
CREATE TABLE benefit_logs (
  benefit_log_id INT PRIMARY KEY AUTO_INCREMENT,
  cutoff_id INT NOT NULL,               -- 1 or 2 (First/Second)
  user_id INT NOT NULL,
  
  benefit_code VARCHAR(20) NOT NULL,    -- 'SSS', 'PAGIBIG', 'PHILHEALTH'
  log_type VARCHAR(20) DEFAULT 'CONTRIBUTION', -- 'CONTRIBUTION', 'LOAN'
  
  loan_id INT,                          -- Nullable, FK to benefit_loans if type=LOAN
  
  source_amount DECIMAL(10, 2) DEFAULT 0,
  deducted_amount DECIMAL(10, 2) NOT NULL,
  
  payroll_run_id INT DEFAULT 0,         -- 0 for manual logs
  payroll_detail_id VARCHAR(255),       -- Manual input for ID reference
  
  note TEXT,
  created_date DATE,                    -- Used as "Cutoff Date"
  
  created_by INT,
  updated_by INT
);
```
```

### C. cutoff_settings (Reference)
Referenced by `benefit_loans.start_cutoff_id`.

```sql
CREATE TABLE cutoff_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cutoff_type VARCHAR(10) NOT NULL,        -- 'FIRST' or 'SECOND'
  year INT NOT NULL,
  month INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payout_date DATE,
  period_status VARCHAR(20) DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
  status VARCHAR(20),                      -- 'published', 'draft'
  created_by INT,
  date_created DATETIME,
  updated_by INT,
  date_updated DATETIME
);
```
