---
description: Analysis of Cutoff Settings Module (Settings, Logic, and DDLs)
---
# Cutoff Settings Module Analysis

## 1. Module Overview
**Path**: `modules/cutoff-settings`
**Entry Point**: `CutoffSettingsModule.tsx`

The Cutoff Settings module is responsible for managing the payroll periods (cutoffs) for the system. It ensures that for any given payroll month, there are exactly two cutoff rows: **FIRST** and **SECOND**.

## 2. Logic & Flow

### Period Determination
The system uses `computeCurrentPayrollPeriod` to determine the active payroll month:
- If today's date is between the **1st and 25th**, the payroll month is the **current calendar month**.
- If today's date is between the **26th and 31st**, the payroll month is the **next calendar month**.

### Automatic Initialization
When the module is loaded:
1. It checks the `cutoff_settings` table for rows matching the computed period.
2. If rows are missing, it automatically creates them using `ensureTwoRowsForCurrentPayrollPeriod`.
3. Default dates are computed:
   - **FIRST Cutoff**: Prev Month 26th to Current Month 10th.
   - **SECOND Cutoff**: Current Month 11th to 25th.

### Benefit Synchronization
Whenever a cutoff period is created or updated:
- The system automatically syncs the `start_date` and `end_date` to the matching rows in `benefit_cutoff_settings`.
- It maps `start_date` -> `effective_from` and `end_date` -> `effective_to`.
- This ensures benefit deduction windows stay in sync with the master payroll cutoffs.

### Data Synchronization (Display)
- **Users Lookup**: The module fetches user names from the `/items/user` collection to display who last updated a setting.
- **Audit History**: Every change (Insert, Update, Delete) is logged into the `cutoff_settings_history` collection via the API route handler.

## 3. Database DDLs (Confirmed Schema)

The module interacts with the following collections.

```sql
-- Main Cutoff Settings Table
CREATE TABLE cutoff_settings (
    id INT PRIMARY KEY,
    status VARCHAR(50),          -- 'published', 'archived', etc.
    month INT,                   -- 1-12
    year INT,
    cutoff_type VARCHAR(10),     -- 'FIRST', 'SECOND'
    start_date DATE,             -- YYYY-MM-DD
    end_date DATE,               -- YYYY-MM-DD
    payout_date DATE NULL,       -- YYYY-MM-DD
    period_status VARCHAR(10),   -- 'OPEN', 'CLOSED'
    created_by VARCHAR(255),     -- User ID
    updated_by VARCHAR(255),     -- User ID
    date_created DATETIME,
    date_updated DATETIME
);

-- Audit History for Cutoff Settings
CREATE TABLE cutoff_settings_history (
    id INT PRIMARY KEY,
    cutoff_setting_id INT,       -- Reference to cutoff_settings.id
    event_type VARCHAR(10),      -- 'INSERT', 'UPDATE', 'DELETE'
    event_at DATETIME,
    changed_by VARCHAR(255),
    status VARCHAR(50),
    month INT,
    year INT,
    cutoff_type VARCHAR(10),
    start_date DATE,
    end_date DATE,
    payout_date DATE,
    period_status VARCHAR(10),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    raw_payload JSON             -- Full data snapshot
);

-- Benefit Cutoff Settings (Synchronized)
CREATE TABLE benefit_cutoff_settings (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    benefit_code ENUM('SSS','PAGIBIG','PHILHEALTH') NOT NULL,
    benefit_name VARCHAR(100) NOT NULL,
    cutoff ENUM('FIRST','SECOND') NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT '1',
    effective_from DATE NULL DEFAULT NULL,
    effective_to DATE NULL DEFAULT NULL,
    created_by INT NULL DEFAULT NULL,
    created_date DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_by INT NULL DEFAULT NULL,
    updated_date DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE INDEX uq_benefit_code (benefit_code)
);

-- User Table (Reference)
CREATE TABLE user (
    id INT PRIMARY KEY,
    user_id INT,                 -- Business/Employee ID
    user_fname VARCHAR(255),
    user_mname VARCHAR(255),
    user_lname VARCHAR(255),
    user_email VARCHAR(255)
);
```

## 4. Key Functions

| Function | Description |
| :--- | :--- |
| `computeCurrentPayrollPeriod` | Logic for determining which payroll month "today" belongs to. |
| `ensureTwoRowsForCurrentPayrollPeriod` | Ensures the DB has the required rows for the active month. |
| `upsertCutoffSettings` | Handles saving/updating rows with audit field stamping. |
| `logHistory` | (Server-side) Records changes to the history table. |
| `syncBenefitCutoffs` | (Server-side) Updates `benefit_cutoff_settings` effective dates based on `cutoff_settings`. |
