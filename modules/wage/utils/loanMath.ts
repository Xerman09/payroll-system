// @modules/wage/utils/loanMath.ts
import { COOP_INTEREST_RATE } from "./payrollConstants";

export function toLocalYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function money(n: string | number | null | undefined) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0.00";
  return v.toFixed(2);
}

export function computeMonthlyPayment(principal: number, terms: number, interestRate: number = 0): number {
  if (terms <= 0) return principal;
  const interest = principal * interestRate;
  const total = principal + interest;
  return round2(total / terms);
}

export function computeCoopInterest(loanAmountNum: number) {
  const amt = Number(loanAmountNum);
  if (!Number.isFinite(amt) || amt <= 0) {
    return {
      interestRate: (COOP_INTEREST_RATE * 100).toFixed(2),
      interestAmount: "0.00",
      netAmountReleased: "0.00",
    };
  }

  const interestAmountNum = round2(amt * COOP_INTEREST_RATE);
  const netNum = round2(amt - interestAmountNum);
  const rateLabel = (COOP_INTEREST_RATE * 100).toFixed(2);

  return {
    interestRate: rateLabel,
    interestAmount: money(interestAmountNum),
    netAmountReleased: money(netNum),
  };
}
