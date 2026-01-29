// modules/payroll-records/utils/money.ts

export function toNumberSafe(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return 0;
    const cleaned = s.replace(/[^0-9.\-]/g, "");
    const x = Number(cleaned);
    return Number.isFinite(x) ? x : 0;
  }
  return 0;
}

export function formatPHP(n: number): string {
  const x = Math.round((n + Number.EPSILON) * 100) / 100;
  return `₱ ${x.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
