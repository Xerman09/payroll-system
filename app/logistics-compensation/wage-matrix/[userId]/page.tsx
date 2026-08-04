import { Metadata } from "next";
import WageMatrixModule from "@/modules/wage-matrix/WageMatrixModule";

export const metadata: Metadata = {
  title: "Logistics Wage Matrix | HR and Payroll System",
};

export default function WageMatrixPage() {
  return <WageMatrixModule />;
}
