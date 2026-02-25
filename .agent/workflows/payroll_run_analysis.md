---
description: Analysis of Payroll Run Module Logic, Flow, and DDLs
---
# Payroll Run Module Analysis

## 1. Module Overview
**Path**: `modules/payroll-run`
**Entry Point**: `PayrollRunModule.tsx`

The Payroll Run module is a comprehensive system designed to orchestrate the calculation, adjustment, and posting of employee payroll. It follows a data-driven approach, pulling from Attendance, Holidays, Wage Profiles, and various adjustment logs to produce a finalized payroll register.

### Stepper Flow
1.  **Configure**: Selection of Cutoff Period and Department. Includes security verification via password and access logging.
2.  **Adjust**: The "Compute" phase. Loads the workspace (all necessary inputs) and generates a preview. Users can "Hold" employees or add manual adjustments (Shortages, DR Payments, etc.).
3.  **Process**: Persists computed lines to the database as `DRAFT` records and updates summary totals.
4.  **Review & Post**: Final validation step. Once confirmed, the run is `POSTED`, locking the records and triggering post-run actions (like marking DR payments as posted).

## 2. Core Logic & Computation Details

The heavy lifting is performed by `payrollRunService.ts` and `utils/compute.ts`.

### Workspace Loading (`loadWorkspace`)
Before computation, the system aggregates all relevant entities for the selected cutoff:
-   **Employees**: Filters active users by department.
-   **Wages**: Fetches `user_wage_management` profiles (Basic, Monthly, Hourly).
-   **Attendance**: Retrieves `approved` records from `attendance_approval` within the cutoff range.
-   **Holidays**: Loads `holiday_calendar` to apply correct multipliers.
-   **Proration Logs**: Fetches `user_wage_proration_log` to handle salary changes mid-cutoff.
-   **Adjustments**: Loads `payroll_other_additions/deductions`, `employee_loan`, `benefit_loans`, `retro_pay`, and `coop_savings_membership`.
-   **DR Payments**: Captures unposted `dr_payment` records for payroll deduction.

### Computation Logic (`computeEmployeeLine`)
For each employee, the system calculates:
1.  **Daily Rate & Proration**:
    -   A `DailyRateResolver` is built using proration logs.
    -   If a salary change occurred, the system calculates pay for each day using the rate effective on that specific date.
2.  **Attendance & Multipliers**:
    -   **Regular Holiday**: 2.0x base, 2.6x OT.
    -   **Special Holiday / Sunday**: 1.3x base, 1.69x OT.
    -   **Combined (e.g., Regular + Rest Day)**: 2.6x base, 3.38x OT.
    -   **Night Differential**: 10% premium on hourly rate for ND minutes.
3.  **Allowances**:
    -   **Recurring**: Either `PER_CUTOFF` (full amount) or `PER_MONTH` (split 50/50).
    -   **One-time**: Applied only if the cutoff window matches and `is_processed` is 0.
4.  **Deductions**:
    -   **Government Benefits**: (SSS, PhilHealth, Pag-IBIG) Split 50/50 per cutoff.
    -   **Employee Loans**: 50/50 split of monthly amortization.
    -   **Benefit Loans**: Based on `deduct_on` setting (`FIRST`, `SECOND`, or `BOTH`).
    -   **Manual**: Shortages, DR Payments (mapped from `dr_payment`), and COOP Savings/Loans.
5.  **Net Pay**: `Total Earnings - Total Deductions`. Includes variance tracking against previous net pay.

## 3. Database DDLs (Confirmed Schema)

The module interacts with the following Directus collections. schema details are derived from `types.ts` and service normalizers.

```sql
-- Core Payroll Run Header
CREATE TABLE payroll_run (
    payroll_run_id INT PRIMARY KEY, -- or AUTO_INCREMENT
    cutoff_id INT,
    cutoff_type VARCHAR(10), -- 'FIRST', 'SECOND'
    cutoff_start DATE,
    cutoff_end DATE,
    department_id INT NULL,
    status VARCHAR(20), -- 'DRAFT', 'POSTED', 'PROCESSED', 'CANCELLED'
    payroll_ref_no VARCHAR(50),
    headcount INT,
    total_gross DECIMAL(12,2),
    total_deductions DECIMAL(12,2),
    total_net DECIMAL(12,2),
    variance_alert_count INT,
    remarks TEXT,
    created_by INT,
    created_at DATETIME,
    processed_at DATETIME,
    posted_by INT,
    posted_at DATETIME
);

-- Computed Employee Payroll Line
CREATE TABLE payroll_run_employee (
    id INT PRIMARY KEY,
    payroll_run_id INT,
    user_id INT,
    
    -- Snapshots for history
    employee_name VARCHAR(255),
    position VARCHAR(100),
    department_name VARCHAR(100),
    
    -- Rates Snapshot
    daily_rate DECIMAL(10,2),
    hourly_rate DECIMAL(10,2),
    monthly_rate DECIMAL(10,2),
    
    -- Attendance Stats
    total_days_worked DECIMAL(5,2),
    total_work_minutes INT,
    late_minutes INT,
    undertime_minutes INT,
    overtime_minutes INT,
    night_diff_minutes INT,
    
    -- Earnings
    basic_pay DECIMAL(10,2),
    ot_amount DECIMAL(10,2),
    holiday_pay DECIMAL(10,2),
    rest_day_amount DECIMAL(10,2),
    night_diff_amount DECIMAL(10,2),
    allowance DECIMAL(10,2),
    retro_pay DECIMAL(10,2),
    manual_additions DECIMAL(10,2),
    
    -- Deductions
    late_deduction DECIMAL(10,2),
    undertime_deduction DECIMAL(10,2),
    shortage_deduction DECIMAL(10,2),
    
    -- Contributions
    benefit_sss DECIMAL(10,2),
    benefit_philhealth DECIMAL(10,2),
    benefit_pagibig DECIMAL(10,2),
    
    -- Loans
    loan_vale DECIMAL(10,2),
    loan_car DECIMAL(10,2),
    loan_coop DECIMAL(10,2),
    benefit_loan_sss DECIMAL(10,2),
    benefit_loan_pagibig DECIMAL(10,2),
    
    -- Other
    dr_deduction DECIMAL(10,2),
    other_deductions DECIMAL(10,2),
    manual_deductions DECIMAL(10,2),
    
    -- Totals
    total_additions DECIMAL(10,2),
    total_deductions DECIMAL(10,2),
    gross_pay DECIMAL(10,2),
    net_pay DECIMAL(10,2),
    
    -- Status
    on_hold TINYINT(1) DEFAULT 0,
    is_prorated TINYINT(1) DEFAULT 0,
    
    -- JSON blobs for detailed breakdowns
    proration_json TEXT, -- details of wage changes
    breakdown_json TEXT  -- full itemized breakdown
);

-- Master Data: Cutoff Settings
CREATE TABLE cutoff_settings (
    id INT PRIMARY KEY,
    cutoff_type VARCHAR(10), -- 'FIRST', 'SECOND'
    start_date DATE,
    end_date DATE,
    payout_date DATE,
    status VARCHAR(20)
);

-- Master Data: Wage / Salary
CREATE TABLE user_wage_management (
    id INT PRIMARY KEY,
    user_id INT,
    daily_wage DECIMAL(10,2),
    hourly_wage DECIMAL(10,2),
    monthly_wage DECIMAL(10,2),
    sss_employee DECIMAL(10,2), 
    philhealth_employee DECIMAL(10,2),
    pagibig_employee DECIMAL(10,2),
    is_deleted TINYINT(1)
);

-- Master Data: Wage Proration (History)
CREATE TABLE user_wage_proration_log (
    id INT PRIMARY KEY,
    user_id INT,
    previous_daily_wage DECIMAL(10,2),
    new_daily_wage DECIMAL(10,2),
    effective_date DATE,
    created_at DATETIME
);

-- Master Data: Attendance
CREATE TABLE attendance_approval (
    approval_id INT PRIMARY KEY,
    employee_id INT,
    date_schedule DATE,
    work_minutes INT,
    late_minutes INT,
    undertime_minutes INT,
    overtime_minutes INT,
    night_diff_minutes INT,
    status VARCHAR(20), -- 'approved'
    approved_by INT,
    approved_at DATETIME
);

-- Master Data: Holidays
CREATE TABLE holiday_calendar (
    id INT PRIMARY KEY,
    holiday_date DATE,
    holiday_type VARCHAR(20), -- 'REGULAR', 'SPECIAL', ...
    description VARCHAR(255),
    is_paid TINYINT(1),
    last_working_day DATE
);

-- Master Data: Allowances
CREATE TABLE employee_allowance (
    allowance_id INT PRIMARY KEY,
    user_id INT,
    amount DECIMAL(10,2),
    description VARCHAR(255),
    is_recurring TINYINT(1),
    pay_cycle VARCHAR(20), -- 'PER_CUTOFF', 'PER_MONTH'
    start_date DATE,
    end_date DATE,
    cutoff_start DATE, -- for one-time
    cutoff_end DATE,   -- for one-time
    is_processed TINYINT(1),
    is_active TINYINT(1)
);

-- Master Data: Loans (Company)
CREATE TABLE employee_loan (
    loan_id INT PRIMARY KEY,
    user_id INT,
    loan_type VARCHAR(50), -- 'VALE', 'CAR LOAN', etc.
    monthly_payment DECIMAL(10,2),
    start_date DATE,
    end_date DATE,
    status VARCHAR(20)
);

-- Master Data: Benefit Loans (SSS/PagIBIG)
CREATE TABLE benefit_loans (
    loan_id INT PRIMARY KEY,
    user_id INT,
    benefit_code VARCHAR(20), -- 'SSS', 'PAGIBIG'
    amortization_amount DECIMAL(10,2),
    deduct_on VARCHAR(10), -- 'FIRST', 'SECOND', 'BOTH'
    remaining_balance DECIMAL(10,2),
    status VARCHAR(20)
);

-- Inputs: Manual Adjustments
CREATE TABLE payroll_other_additions (
    id INT PRIMARY KEY,
    user_id INT,
    amount DECIMAL(10,2),
    description VARCHAR(255),
    cutoff_start DATE,
    cutoff_end DATE,
    category VARCHAR(50)
);

CREATE TABLE payroll_other_deductions (
    id INT PRIMARY KEY,
    user_id INT,
    amount DECIMAL(10,2),
    description VARCHAR(255),
    cutoff_start DATE,
    cutoff_end DATE,
    category VARCHAR(50) -- 'SHORTAGE', 'DR_PAYMENT', 'MANUAL_DEDUCTION'
);

-- Inputs: DR Payments (linked to deductions)
CREATE TABLE dr_payment (
    dr_payment_id INT PRIMARY KEY,
    employee_id INT,
    amount_paid DECIMAL(10,2),
    delivery_receipt_number VARCHAR(50),
    payment_method VARCHAR(50), -- 'PAYROLL_DEDUCTION'
    payment_date DATE,
    is_posted_to_payroll TINYINT(1),
    cutoff_from DATE,
    cutoff_to DATE
);

-- Access Log
CREATE TABLE payroll_run_access_log (
    id INT PRIMARY KEY,
    opened_by INT,
    cutoff_id INT,
    department_id INT,
    remarks TEXT,
    created_at DATETIME
);

-- Benefit Logs (Inserted during Posting Phase)
```sql
CREATE TABLE `benefit_logs` (
  `benefit_log_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `cutoff_id` int unsigned NOT NULL,
  `cutoff_start` date DEFAULT NULL,
  `cutoff_end` date DEFAULT NULL,
  `cutoff_type` enum('FIRST','SECOND') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_id` int NOT NULL,
  `benefit_code` enum('SSS','PAGIBIG','PHILHEALTH') NOT NULL,
  `log_type` enum('CONTRIBUTION','LOAN') NOT NULL DEFAULT 'CONTRIBUTION',
  `loan_id` bigint unsigned DEFAULT NULL,
  `source_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `deducted_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `payroll_run_id` bigint unsigned NOT NULL,
  `payroll_detail_id` varchar(255) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`benefit_log_id`),
  UNIQUE KEY `uq_blog_unique` (`cutoff_id`,`user_id`,`benefit_code`,`log_type`,`loan_id`,`payroll_run_id`),
  KEY `idx_blog_cutoff` (`cutoff_id`),
  KEY `idx_blog_user_cutoff` (`user_id`,`cutoff_id`),
  KEY `idx_blog_benefit` (`benefit_code`),
  KEY `idx_blog_type` (`log_type`),
  KEY `idx_blog_loan` (`loan_id`),
  KEY `idx_blog_payroll_run` (`payroll_run_id`),
  CONSTRAINT `chk_loan_id_required_for_loan` CHECK ((((`log_type` = _utf8mb4'CONTRIBUTION') and (`loan_id` is null)) or ((`log_type` = _utf8mb4'LOAN') and (`loan_id` is not null)))),
  CONSTRAINT `chk_loan_not_philhealth` CHECK (((`log_type` = _utf8mb4'CONTRIBUTION') or ((`log_type` = _utf8mb4'LOAN') and (`benefit_code` in (_utf8mb4'SSS',_utf8mb4'PAGIBIG')))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

## 4. Post-Run Logic (`postRun`)
When a payroll is finalized, the `postRun` function is triggered to mark the run as `POSTED` and reflect the deductions in the employees' ongoing balances. The logic follows these steps:

1. **Update Employee Loans**: Deductions for company loans (e.g., Vale, Car Loan) are grouped by `loan_id` and added to the `accumulated_amount`. Idempotency is maintained via `last_paid_cutoff_id`. Fully paid loans are automatically marked as `PAID`.
2. **Update Benefit Loans**: SSS and Pag-IBIG loan deductions are recorded. The `accumulated_amount` increases and `remaining_balance` decreases. Fully paid loans are marked as `CLOSED`. 
3. **Update Coop Savings**: `coop_savings_items` deductions are accumulated into the employee's `total_collection` and `total_months` counter.
4. **Insert Benefit Logs (`createBenefitLogs`)**: 
   The system documents government contributions and benefit loan payments. Due to MySQL's unique constraint handling (where `NULL != NULL`), the system splits this into two strategies:
   - **Contributions (`log_type = 'CONTRIBUTION'`)**: The unique constraint includes `loan_id`, which is `NULL` for contributions. To avoid duplicates, the system employs a **delete-then-insert** strategy. It finds and deletes all existing contribution rows for the current users in this cutoff, then builds and inserts fresh rows for SSS, PhilHealth, and Pag-IBIG based on computed amounts.
   - **Loans (`log_type = 'LOAN'`)**: For loans, `loan_id` is populated, so the unique constraint works correctly. The system uses an **upsert** strategy. It checks existing loan logs matching `userId|benefitCode|loanId` and either updates the existing log (`patchItem`) or creates a new one (`createItem`).

5. **Mark as Posted**: The `payroll_run` header status is updated to `POSTED` with the timestamp and user ID.

