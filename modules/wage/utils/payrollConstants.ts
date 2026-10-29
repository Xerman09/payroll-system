// modules/wage/utils/payrollConstants.ts

/**
 * Standard working days used for wage estimations and proration logic.
 */
export const WORKING_DAYS_PER_MONTH = 26;

/**
 * Standard interest rate for COOP and benefit-related loans (3.00%).
 */
export const COOP_INTEREST_RATE = 0.03;

/**
 * Default terms for benefit loans (months) if not specified.
 */
export const DEFAULT_LOAN_TERMS = 12;

/**
 * Standard SSS loan types in Philippine payroll.
 */
export const SSS_LOAN_OPTIONS = [
  "Salary Loan",
  "Calamity Loan",
  "Emergency Loan",
  "Educational Loan",
  "Stock Investment Loan",
] as const;

/**
 * Standard Pag-IBIG loan types in Philippine payroll.
 */
export const PAGIBIG_LOAN_OPTIONS = [
  "Multi-Purpose Loan (MPL)",
  "Calamity Loan",
  "Housing Loan",
] as const;
