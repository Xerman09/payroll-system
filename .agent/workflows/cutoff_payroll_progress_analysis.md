---
description: Analysis of Cutoff Payroll Progress Logic, Active Window Rules, and Formulas
---
# Cutoff Payroll Progress Analysis

## 1. Overview
**Primary Files**:
- Service: [dashboardService.ts](file:///c:/Users/ace_c/Desktop/Vertex%20Files/system/payroll_system/modules/dashboard/providers/dashboardService.ts)
- Component: [CutoffProgressCard.tsx](file:///c:/Users/ace_c/Desktop/Vertex%20Files/system/payroll_system/modules/dashboard/components/CutoffProgressCard.tsx)
- Unified API: [route.ts](file:///c:/Users/ace_c/Desktop/Vertex%20Files/system/payroll_system/app/api/unified/payroll-status/route.ts)
- Comprehensive Spec: [CURRENT_CUTOFF_PAYROLL_PROGRESS.md](file:///c:/Users/ace_c/Desktop/Vertex%20Files/system/payroll_system/CURRENT_CUTOFF_PAYROLL_PROGRESS.md)

## 2. Core Logic Summary

### A. Current Cutoff Identification (+1 Day Rule)
1. **Payout Date Resolution**:
   - Explicit `payout_date` in `cutoff_settings`, or default:
     - `FIRST` Cutoff -> 15th of the payroll month.
     - `SECOND` Cutoff -> Last day of the payroll month.
     - Fallback -> `end_date + 5 days`.
2. **Cutoff Active Window**:
   - `paidDayPlusOne = payoutDate + 1 day (at 23:59:59.999)`.
   - Current cutoff = First chronological cutoff where `now <= paidDayPlusOne`.
   - Fallback if all are past: Latest cutoff row in the database.

### B. Department Completion
1. **Scope**: Active departments where `is_delete != 1`.
2. **Posted Status Check**:
   - If ANY consolidated run (`department_id IS NULL / 0 / 'ALL'`) has `status = 'POSTED'`, **all** departments are considered completed.
   - Otherwise, check if an individual run with `status = 'POSTED'` exists for each department ID.
3. **Formula**:
   $$\text{percentage} = \text{totalDepartments} > 0 \ ? \ \text{round}\left(\frac{\text{completedDepartments}}{\text{totalDepartments}} \times 100\right) : 0$$
