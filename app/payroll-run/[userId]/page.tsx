import React from "react";
import PayrollRunModule from "@/modules/payroll-run/PayrollRunModule";

export const metadata = {
  title: "Payroll Run",
};

export default function PayrollRunPage() {
  const showModal = process.env.SHOW_MOBAL_ART_103 === "true";
  return <PayrollRunModule showLaborLawModal={showModal} />;
}
