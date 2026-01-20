// @modules/wage/utils/loanMath.ts
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

export function computeMonthlyPayment(loanAmountStr: string, monthsStr: string) {
  const amt = Number(loanAmountStr);
  const months = Number(monthsStr);

  if (!Number.isFinite(amt) || amt <= 0) return "0.00";
  if (!Number.isInteger(months) || months <= 0) return "0.00";

  return money(round2(amt / months));
}

export function computeCoopInterest(loanAmountNum: number) {
  const amt = Number(loanAmountNum);
  if (!Number.isFinite(amt) || amt <= 0) {
    return {
      interestRate: "3.00",
      interestAmount: "0.00",
      netAmountReleased: "0.00",
    };
  }

  const interestAmountNum = round2(amt * 0.03);
  const netNum = round2(amt - interestAmountNum);

  return {
    interestRate: "3.00",
    interestAmount: money(interestAmountNum),
    netAmountReleased: money(netNum),
  };
}
