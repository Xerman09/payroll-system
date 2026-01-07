# Payroll Run Module (Prototype)

This module is a static-data prototype based on the provided HTML sample.

## What’s included
- Stepper flow: Config → Adjust → Process → Review
- Hold toggle to exclude employees
- Adjustment modal (Earning/Deduction + optional recurring label)
- Prototype proration logic (salary change within cutoff splits pay)
- Variance highlighting (>20%)

## Unit tests
Pure functions live under `src/modules/payroll-run/utils/`.
Tests use Node's built-in test runner:

```bash
node --test src/modules/payroll-run/utils/payroll.test.ts
```
