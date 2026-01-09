export function formatPeso(n: number | string): string {
  const num = Number(n || 0);
  return `₱${num.toLocaleString(undefined, {
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

export function getLoggedUserIdFallback1(): number {
  try {
    const s = sessionStorage.getItem("user");
    return s ? Number(JSON.parse(s)?.user_id) || 1 : 1;
  } catch {
    return 1;
  }
}
