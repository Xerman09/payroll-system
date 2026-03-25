export function formatPeso(n: number | string): string {
  const num = Number(n || 0);
  return `PHP ${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function monthsBetweenInclusive(
  start: string | null,
  end: string | null
): number {
  if (!start) return 0;
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const yearDiff = endDate.getFullYear() - startDate.getFullYear();
  const monthDiff = endDate.getMonth() - startDate.getMonth();
  const totalMonths = yearDiff * 12 + monthDiff;
  return totalMonths + 1; // inclusive
}

import { getLoggedUser } from "@/lib/auth";

export function getLoggedUserIdFallback1(): number {
  const user = getLoggedUser();
  if (!user || !user.user_id) return 1;
  return Number(user.user_id);
}
