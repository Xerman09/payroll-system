---
description: Analysis of Wage Management Module (Logic, Flow, and DDLs)
---

# Wage Management Module Analysis

## 1. Logic and Flow Analysis

### Overview
The Wage Management module is the central hub for managing employee compensation, benefits, loans, and financial adjustments. it is accessible via the dashboard and follows a hierarchical structure where a main list of employees acts as the entry point for individual wage management.

### Component Hierarchy & Data Flow
1.  **`WageModule.tsx` (Main Orchestrator)**
    *   **Logic**: Handles the main layout, department filtering, and employee search/pagination.
    *   **Flow**:
        1.  Fetches `departments` and a paginated `employee` list on mount.
        2.  Provides a "View Wage Info" action which triggers a password check (`PasswordDialog`).
        3.  Once verified, it calls `loadWageData` for the specific user.
        4.  Manages the `WageModal` state, including the `wageData` object which is passed down to all tabs.
        5.  Implements `saveWageData` which persists changes to the `user_wage_management` table and logs access via `user_wage_access_log`.

2.  **`WageModal.tsx` (Container)**
    *   **Logic**: A multi-tab interface (Shadcn Tabs) that hosts 8 specialized functional tabs.
    *   **State**: It coordinates shared data like `cutoffs` (fetched via `ensureCutoffs`) and handles the global "Save" action for items in the `Wage` tab.

3.  **Functional Tabs (The 8 Modules)**
    *   **Wage Tab (`WageTab.tsx`)**: Edits core compensation (daily wage), leave credits, and payroll flags (Paid Holiday, Is Card).
    *   **Loans Tab (`LoansTab.tsx`)**: Manages employee loans (Company/Personal). Features auto-computation of interest and amortization.
    *   **Allowance Tab (`AllowanceTab.tsx`)**: Handles recurring or one-time allowances.
    *   **Benefits Tab (`BenefitsTab.tsx`)**: Manages statutory contributions and benefit-related loans (SSS/Pag-IBIG).
    *   **Other A/D Tab (`OtherADTab.tsx`)**: One-off additions or deductions tied to a specific cutoff.
    *   **Retro Pay Tab (`RetroPayTab.tsx`)**: Individual retro-active payment adjustments per cutoff.
    *   **Savings Tab (`SavingsTab.tsx`)**: Manages COOP savings memberships and monthly collection schedules.
    *   **Stock Purchase Tab (`StockPurchaseTab.tsx`)**: Tracks Delivery Receipt (DR) payments usually for stock/commodity purchases.

### API Strategy
*   **Client Side (`wageApi.ts`)**: Abstracted data fetching using a generic `apiFetch` that handles Directus tokens and error parsing.
*   **Backend Proxy (`app/api/wage/route.ts`)**: Acts as a secure gateway to the external Directus API, forwarding headers and handling CORS/authentication.
*   **Audit Trail**: The system meticulously logs every wage access and tracks major changes (like daily wage updates) via `user_wage_proration_log`.

---

## 2. Functions Analysis

| Function | Location | Description |
| :--- | :--- | :--- |
| `loadWageData` | `WageModule.tsx` | Fetches base wage, access logs, and proration history for a user. |
| `saveWageData` | `WageModule.tsx` | Persists core wage changes and creates proration logs if the daily wage changed. |
| `fetchDepartments` | `wageApi.ts` | Retrieves the list of departments for filtering. |
| `fetchEmployees` | `wageApi.ts` | Retrieves paginated employee list with search/filter parameters. |
| `fetchLoansByUser` | `wageApi.ts` | Fetches all loan records for a specific employee. |
| `applyCutoffSelection` | Various Tabs | Maps selected `cutoff_setting_id` to start/end dates in drafts. |

---

## 3. Database DDLs (Inferred Schemas)

### A. user & department (References)
```sql
CREATE TABLE user (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  user_fname VARCHAR(255) NOT NULL,
  user_lname VARCHAR(255) NOT NULL,
  user_department INT, -- FK to department
  is_deleted TINYINT(1) DEFAULT 0
);

CREATE TABLE department (
  department_id INT PRIMARY KEY AUTO_INCREMENT,
  department_name VARCHAR(255) NOT NULL
);
```

### B. user_wage_management (Core)
```sql
CREATE TABLE user_wage_management (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL, -- FK to user
  daily_wage DECIMAL(10, 2) NOT NULL,
  vacation_leave_per_year DECIMAL(10, 2) DEFAULT 0,
  sick_leave_per_year DECIMAL(10, 2) DEFAULT 0,
  paid_holiday TINYINT(1) DEFAULT 0,
  isCard TINYINT(1) DEFAULT 0,
  sss_contribution_monthly DECIMAL(10, 2) DEFAULT 0,
  pagibig_contribution_monthly DECIMAL(10, 2) DEFAULT 0,
  philhealth_contribution_monthly DECIMAL(10, 2) DEFAULT 0,
  cutoff_wage_date_update DATE,
  created_by INT,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INT,
  updated_date DATETIME
);
```

### C. user_wage_access_log & proration_log
```sql
CREATE TABLE user_wage_access_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL, -- FK to target user
  opened_by INT NOT NULL, -- FK to user who viewed
  remarks TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_wage_proration_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  previous_daily_wage DECIMAL(10, 2) NOT NULL,
  new_daily_wage DECIMAL(10, 2) NOT NULL,
  effective_date DATE NOT NULL,
  cutoff_id INT NOT NULL, -- FK to cutoff_settings
  updated_by INT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### D. employee_loan (Company/Personal)
```sql
CREATE TABLE employee_loan (
  loan_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  loan_type VARCHAR(50) NOT NULL, -- 'VALE', 'CAR LOAN', 'COOP'
  loan_amount DECIMAL(10, 2) NOT NULL,
  months_to_pay INT NOT NULL,
  monthly_payment DECIMAL(10, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  interest_rate DECIMAL(5, 2) DEFAULT 0,
  interest_amount DECIMAL(10, 2) DEFAULT 0,
  net_amount_released DECIMAL(10, 2) NOT NULL,
  accumulated_amount DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_by INT,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INT,
  updated_date DATETIME
);
```

### E. allowance & retro_pay
```sql
CREATE TABLE employee_allowance (
  allowance_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  cutoff_start DATE,
  cutoff_end DATE,
  is_recurring TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  pay_cycle VARCHAR(50), -- 'N/A', 'PER_CUTOFF', 'PER_MONTH'
  start_date DATE,
  end_date DATE,
  is_processed TINYINT(1) DEFAULT 0,
  created_by INT,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INT,
  updated_date DATETIME
);

CREATE TABLE retro_pay (
  retro_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  cutoff_start DATE NOT NULL,
  cutoff_end DATE NOT NULL,
  is_processed TINYINT(1) DEFAULT 0,
  created_by INT,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INT,
  updated_date DATETIME
);
```

### F. other_additions & other_deductions
```sql
CREATE TABLE payroll_other_additions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  cutoff_start DATE NOT NULL,
  cutoff_end DATE NOT NULL,
  created_by INT,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payroll_other_deductions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  cutoff_start DATE NOT NULL,
  cutoff_end DATE NOT NULL,
  created_by INT,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### G. benefit_loans & benefit_logs
```sql
CREATE TABLE benefit_loans (
  loan_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  benefit_code VARCHAR(10) NOT NULL, -- 'SSS', 'PAGIBIG'
  loan_name VARCHAR(255),
  reference_no VARCHAR(100),
  principal_amount DECIMAL(10, 2) NOT NULL,
  interest_amount DECIMAL(10, 2) NOT NULL,
  total_payable DECIMAL(10, 2) NOT NULL,
  accumulated_amount DECIMAL(10, 2) DEFAULT 0,
  amortization_amount DECIMAL(10, 2) NOT NULL,
  terms_installments INT NOT NULL,
  deduct_on VARCHAR(10) NOT NULL, -- 'FIRST', 'SECOND', 'BOTH'
  start_cutoff_id INT NOT NULL, -- FK to cutoff_settings
  paid_installments INT DEFAULT 0,
  remaining_balance DECIMAL(10, 2) NOT NULL,
  last_paid_cutoff_id INT, -- FK to cutoff_settings
  status VARCHAR(20) DEFAULT 'ACTIVE',
  remarks TEXT,
  created_by INT,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INT,
  updated_date DATETIME
);

CREATE TABLE benefit_logs (
  benefit_log_id INT PRIMARY KEY AUTO_INCREMENT,
  cutoff_id INT NOT NULL, -- 1 or 2
  user_id INT NOT NULL,
  benefit_code VARCHAR(10) NOT NULL, -- 'SSS', 'PAGIBIG', 'PHILHEALTH'
  log_type VARCHAR(20) NOT NULL, -- 'CONTRIBUTION', 'LOAN'
  loan_id INT, -- FK to benefit_loans
  source_amount DECIMAL(10, 2) DEFAULT 0,
  deducted_amount DECIMAL(10, 2) NOT NULL,
  payroll_run_id INT DEFAULT 0,
  payroll_detail_id VARCHAR(255),
  note TEXT,
  created_date DATE,
  created_by INT,
  updated_by INT
);
```

### H. savings_membership & dr_payment
```sql
CREATE TABLE coop_savings_membership (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  membership_id VARCHAR(100) NOT NULL,
  monthly_amount DECIMAL(10, 2) NOT NULL,
  total_collection DECIMAL(10, 2) DEFAULT 0,
  total_months INT DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE,
  is_active TINYINT(1) DEFAULT 1,
  created_by INT,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INT,
  updated_date DATETIME
);

CREATE TABLE dr_payment (
  dr_payment_id INT PRIMARY KEY AUTO_INCREMENT,
  delivery_receipt_number VARCHAR(100) NOT NULL,
  employee_id INT NOT NULL, -- user_id
  cutoff_from DATE NOT NULL,
  cutoff_to DATE NOT NULL,
  payroll_ref_no VARCHAR(100),
  is_posted_to_payroll TINYINT(1) DEFAULT 0,
  payment_date DATE NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50), -- 'PAYROLL_DEDUCTION', 'CASH', etc.
  remarks TEXT,
  created_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### I. cutoff_settings
```sql
CREATE TABLE cutoff_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cutoff_type VARCHAR(10) NOT NULL, -- 'FIRST', 'SECOND'
  year INT NOT NULL,
  month INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payout_date DATE,
  period_status VARCHAR(20) DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
  status VARCHAR(20), -- 'published', 'draft'
  created_by INT,
  date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INT,
  date_updated DATETIME
);
```

### J. salary_schedules (New Feature)
```sql
CREATE TABLE salary_schedules (
    schedule_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    
    effectivity_date DATE NOT NULL 
        COMMENT 'DBM schedule effectivity (e.g. 2023-01-01)',
    
    salary_grade TINYINT UNSIGNED NOT NULL 
        CHECK (salary_grade BETWEEN 1 AND 33),
    
    step TINYINT UNSIGNED NOT NULL 
        CHECK (step BETWEEN 1 AND 8),
    
    monthly_rate DECIMAL(10,2) NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uniq_schedule (
        effectivity_date,
        salary_grade,
        step
    ),
    
    INDEX idx_effectivity (effectivity_date),
    INDEX idx_grade_step (salary_grade, step)
);
```

---

## 4. UI DDLs (Dropdown / Select Inputs)

The following dropdowns are used across the module to ensure data consistency:

| Component | Label / Field | Options / Source |
| :--- | :--- | :--- |
| `WageModule` | Department | Dynamic from `departments` table |
| `AllowanceTab` | Pay Cycle | `MONTHLY`, `BI_MONTHLY`, `ONE_TIME` |
| `AllowanceTab` | Cutoff Setting | Dynamic from `cutoff_settings` |
| `LoansTab` | Loan Type | `COMPANY`, `PERSONAL`, `COOP`, `EMERGENCY` |
| `LoansTab` | Deduct On | `1st Cutoff`, `2nd Cutoff`, `Both` |
| `BenefitsTab` | Benefit Code | `SSS`, `PAGIBIG`, `PHILHEALTH` |
| `BenefitsTab` | Status | `ACTIVE`, `CLOSED`, `CANCELLED` |
| `StockPurchaseTab`| Method | `PAYROLL_DEDUCTION`, `CASH`, `CHECK`, `BANK_TRANSFER` |
| `OtherADTab` | Entry Type | `Addition`, `Deduction` |
