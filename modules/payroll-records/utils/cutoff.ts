// modules/payroll-records/utils/cutoff.ts
import type { CutoffHistoryRow } from "../types";

export function buildCutoffLabel(c: CutoffHistoryRow): string {
  const t = (c.cutoff_type || "").toUpperCase();
  return `${c.start_date} → ${c.end_date} (${t})`;
}

export function parseCutoffValue(v: string): { start: string; end: string } | null {
  const [start, end] = (v || "").split("|");
  if (!start || !end) return null;
  return { start, end };
}

export function uniqCutoffs(rows: CutoffHistoryRow[]): CutoffHistoryRow[] {
  const m = new Map<string, CutoffHistoryRow>();
  for (const r of rows) {
    const key = `${r.start_date}|${r.end_date}|${(r.cutoff_type || "").toUpperCase()}`;
    const prev = m.get(key);
    if (!prev) m.set(key, r);
    else {
      const a = new Date(prev.event_at).getTime();
      const b = new Date(r.event_at).getTime();
      if (b >= a) m.set(key, r);
    }
  }

  return Array.from(m.values()).sort(
    (a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime(),
  );
}
