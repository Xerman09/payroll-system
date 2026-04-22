import React from "react";
import PayrollRunModule from "@/modules/payroll-run/PayrollRunModule";

export const metadata = {
  title: "Payroll Run",
};

/**
 * Root payroll run page.
 * Standardized URL structure: /payroll-run
 */
export default function PayrollRunRootPage() {
  return <PayrollRunModule />;
}
