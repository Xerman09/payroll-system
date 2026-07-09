import { NextRequest, NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const config = await resolveApiConfig();
  if (!config) {
    return NextResponse.json({ error: "No enterprise entity selected. Please visit the portal to choose one." }, { status: 400 });
  }

  const headers = buildForwardHeaders(req, config);
  const API_BASE = config.apiBase;

  try {
    // 1. Fetch memberships & loans
    const [memsRes, loansRes, prRes] = await Promise.all([
      fetch(`${API_BASE}/items/coop_savings_membership?limit=-1`, { headers }),
      fetch(`${API_BASE}/items/employee_loan?limit=-1&filter[category][_eq]=COOP_LOAN`, { headers }),
      fetch(`${API_BASE}/items/payroll_run_employee?limit=-1`, { headers })
    ]);

    const memsJson = await memsRes.json();
    const loansJson = await loansRes.json();
    const prJson = await prRes.json();

    const mems = memsJson.data || [];
    const loans = loansJson.data || [];
    const rows = prJson.data || [];

    const savingsSumByUser: Record<number, number> = {};
    const savingsMonthsByUser: Record<number, number> = {};
    
    const loansSumByUser: Record<number, number> = {};

    for (const row of rows) {
      const s = Number(row.coop_savings) || 0;
      if (s > 0) {
        const uid = Number(row.user_id);
        savingsSumByUser[uid] = (savingsSumByUser[uid] || 0) + s;
        savingsMonthsByUser[uid] = (savingsMonthsByUser[uid] || 0) + 1;
      }
      
      const l = Number(row.coop_loan) || 0;
      if (l > 0) {
        const uid = Number(row.user_id);
        loansSumByUser[uid] = (loansSumByUser[uid] || 0) + l;
      }
    }

    const updates = [];

    // Update Memberships
    for (const m of mems) {
      const uid = Number(m.user_id);
      if (savingsSumByUser[uid]) {
        await fetch(`${API_BASE}/items/coop_savings_membership/${m.id}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            total_collection: savingsSumByUser[uid],
            total_months: savingsMonthsByUser[uid]
          })
        });
        updates.push({ type: "savings", uid, total: savingsSumByUser[uid] });
      }
    }
    
    // Update Loans
    for (const l of loans) {
      const uid = Number(l.user_id);
      if (loansSumByUser[uid]) {
        await fetch(`${API_BASE}/items/employee_loan/${l.id}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            accumulated_amount: loansSumByUser[uid]
          })
        });
        updates.push({ type: "loan", uid, total: loansSumByUser[uid] });
      }
    }

    return NextResponse.json({ message: "Sync successful!", updates });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
