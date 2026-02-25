---
description: Analysis of Payroll Records Top Sheet Module (Logic, Flow, and DDLs)
---

# Payroll Records - Top Sheet Tab Analysis

This document outlines the logic, flow, functions, and DDLs used in the `modules/payroll-records` Top Sheet Tab.

## 1. Flow & Logic

### Overview
The **Top Sheet Tab** (`TapSheetTab.tsx`) provides a summarized view of the payroll runs for a specific cutoff and department. It allows users to filter, sort, preview, and download a PDF representation of the top sheet.

### Data Fetching & State
- **Initial Load:** The component receives base data (`employees`, `departments`, `cutoffs`) from its parent via props.
- **Selection:** Users select a **Cutoff Date** and a **Department** (or "All Departments").
- **API Call:** When a cutoff and department are selected, a `useEffect` triggers `fetchTapSheet()` which calls `GET /api/payroll-records?type=top-sheet`.
- **Data Processing (Client-Side):**
  - **On-Hold Filtering:** The client double-checks that any row with `on_hold` explicitly true is excluded (using the `isTruthyFlag` helper).
  - **Deduplication:** Multiple payroll runs for the same user in the same cutoff are deduped using `dedupeByUserKeepLatestRun`, keeping only the latest.
  - **Mapping:** `buildTapSheetRows` maps the raw entries against the `employees` master list to create full names and determines the payment type (`BANK` or `CASH`) based on the `is_card` flag.
  - **Sorting & Searching:** In-memory searching (by employee name) and sorting (by name, gross pay, additions, deductions, or net pay) is performed.
  - **Aggregations:** A `Totals` row computes the sum for Gross Pay, Total Additions, Total Deductions, and Net Pay across the filtered set.
  
### PDF Export function
- Clicking **"Preview & Download PDF"** opens a modal.
- The user can choose to filter the PDF by `ALL`, `BANK`, or `CASH`.
- `generatePdfBlob` calculates new subtotals for the selected filter and calls `buildTapSheetPdf`.
- A blob URL is generated and displayed in an iframe preview, with an option to download.

## 2. API & Backend Functions

### Route: `app/api/payroll-records/route.ts`
When `type=top-sheet` is queried:
- **Filtering by Cutoff & Dept:** Adds exact match filters `filter[cutoff_start][_eq]` and `filter[cutoff_end][_eq]`. If a department is selected, it filters by `department_name_snapshot` or `department_name` using `_or`.
- **Filtering On-Hold:** Adds `filter[on_hold][_neq]=true` in the Directus query URL to exclude on-hold records at the DB level. As a fallback, it also does a `.filter((row) => !isTruthyFlag(row?.on_hold))` on the array returned.
- **Sorting:** Sorts descending by `payroll_run_id` and `id`.

## 3. DDLs Used (Data Dictionary)

The functionality relies on the following tables/collections from Directus:

### `user` (Employees)
- `user_id` (Primary Key)
- `user_fname`, `user_mname`, `user_lname` (Name construction)
- `user_department`, `user_position`, `user_contact`
- `user_dateOfHire`
- `is_deleted`

### `department`
- `department_id` (Primary Key)
- `department_name`

### `cutoff_settings_history`
- `id` (Primary Key)
- `cutoff_setting_id`
- `event_at`
- `status`
- `month`, `year`, `cutoff_type`
- `start_date`, `end_date`, `payout_date`
- `period_status`

### `payroll_run_employee`
Provides the actual payout data for the top sheet.
- `id` (Primary Key)
- `payroll_run_id` (Relational object, includes `payroll_ref_no`, `posted_at`)
- `user_id` (Foreign Key to `user`)
- `employee_name`
- `department_name`, `department_name_snapshot`
- `cutoff_start`, `cutoff_end`, `cutoff_label`
- `gross_pay`, `total_additions`, `total_deductions`, `net_pay`
- `created_at`
- `on_hold` (Boolean-like flag used to exclude records)
- `is_card` (Boolean-like flag used to determine Payment Type: true = BANK, false = CASH)
