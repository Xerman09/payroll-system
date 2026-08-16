import { NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cutoffId = searchParams.get("cutoff_id");
    
    const config = await resolveApiConfig();
    const apiBase = config?.apiBase;
    if (!apiBase) {
      return NextResponse.json({ error: "No API base configured" }, { status: 500 });
    }

    const headers = buildForwardHeaders(request, config, { forceServiceToken: true });

    // Build query for payroll runs
    const runQuery = new URLSearchParams({
      "filter[status][_eq]": "POSTED",
    });

    if (cutoffId) {
      runQuery.set("filter[cutoff_id][_eq]", cutoffId);
    }

    // 1. Fetch POSTED payroll runs
    const runRes = await fetch(`${apiBase}/items/payroll_run?${runQuery.toString()}`, {
      headers,
    });
    
    if (!runRes.ok) {
      throw new Error(`Failed to fetch payroll runs: ${runRes.statusText}`);
    }

    const runData = await runRes.json();
    const runs = runData.data || [];

    if (runs.length === 0) {
      return NextResponse.json([]);
    }

    const runIds = runs.map((r: any) => r.id || r.payroll_run_id).filter(Boolean);

    // 2. Fetch employees for these runs who are NOT on hold
    const empQuery = new URLSearchParams({
      "filter[payroll_run_id][_in]": runIds.join(","),
      "fields": "id,user_id,employee_name,department_name,position,basic_pay,gross_pay,net_pay,payroll_run_id,is_payslip_sent,payslip_sent_at,payslip_sent_by,on_hold",
      "limit": "-1"
    });

    const empRes = await fetch(`${apiBase}/items/payroll_run_employee?${empQuery.toString()}`, {
      headers,
    });

    if (!empRes.ok) {
      throw new Error(`Failed to fetch employees: ${empRes.statusText}`);
    }

    const empData = await empRes.json();
    let employees = empData.data || [];
    
    // Filter out on-hold employees safely in code
    employees = employees.filter((emp: any) => emp.on_hold !== 1 && emp.on_hold !== true && emp.on_hold !== "1" && emp.on_hold !== "true");

    // 3. Map with cutoff info
    const mapped = employees.map((emp: any) => {
      const run = runs.find((r: any) => (r.id || r.payroll_run_id) === emp.payroll_run_id);
      return {
        ...emp,
        cutoff_period: run ? `${run.cutoff_start || ''} to ${run.cutoff_end || ''}` : "Unknown",
        cutoff_start: run?.cutoff_start,
        cutoff_end: run?.cutoff_end,
      };
    });

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Payslip Dispatch API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
