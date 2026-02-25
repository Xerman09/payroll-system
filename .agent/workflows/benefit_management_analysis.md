---
description: Analysis of Benefit Management Module (Settings, Loans, and Logs)
---

# Benefit Management Module Analysis

## Overview
The Benefit Management module (`benefit-settings`) is a centralized system for configuring statutory contributions (SSS, PhilHealth, Pag-IBIG), managing benefit loans, and reviewing posted benefit logs.

## 1. Logic and Flow

### A. Benefit Settings
- **Path**: `modules/benefit-settings/BenefitSettingsModule.tsx`
- **Logic**: Configures which cutoff (1st, 2nd, or None) a benefit is deducted.
- **Data Flow**: Updates `benefit_cutoff_settings` table. Derived dates (`effective_from/to`) are synced from `cutoff_settings`.

### B. Benefit Loans
- **Path**: `modules/benefit-settings/components/BenefitLoansTab.tsx`
- **Auto-Computation**:
    - Interest = Principal * (Rate/100)
    - Total = Principal + Interest
    - Amortization = Total / Terms
- **Persistence**: CRUD on `benefit_loans` table.

### C. Benefit Logs
- **Path**: `modules/benefit-settings/components/BenefitLogsTab.tsx`
- **Merging**: Combines `payroll_run_employee` (system) and `benefit_logs` (manual). Manual logs take precedence.

## 2. Inferred DDLs

### benefit_cutoff_settings
```sql
CREATE TABLE benefit_cutoff_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  benefit_code VARCHAR(20),
  cutoff VARCHAR(10),
  effective_from DATE,
  effective_to DATE
);
```

### benefit_loans
```sql
CREATE TABLE benefit_loans (
  loan_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  benefit_code VARCHAR(20),
  principal_amount DECIMAL(10, 2),
  interest_amount DECIMAL(10, 2),
  total_payable DECIMAL(10, 2),
  amortization_amount DECIMAL(10, 2),
  terms_installments INT,
  deduct_on VARCHAR(10),
  start_cutoff_id INT,
  status VARCHAR(20)
);
```

### benefit_logs
```sql
CREATE TABLE benefit_logs (
  benefit_log_id INT PRIMARY KEY AUTO_INCREMENT,
  cutoff_id INT,
  user_id INT,
  benefit_code VARCHAR(20),
  log_type VARCHAR(20),
  deducted_amount DECIMAL(10, 2),
  payroll_run_id INT
);
```
