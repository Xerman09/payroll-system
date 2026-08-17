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
      "fields": "id,user_id,employee_name,department_name,department_name_snapshot,position,basic_pay,gross_pay,net_pay,payroll_run_id,is_payslip_sent,payslip_sent_at,payslip_sent_by,on_hold",
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

    // 2.5 Resolve missing department names from the user -> department relation
    const userIds = [...new Set(employees.map((e: any) => e.user_id).filter(Boolean))];
    if (userIds.length > 0) {
      const userRes = await fetch(`${apiBase}/items/user?filter[user_id][_in]=${userIds.join(",")}&fields=user_id,user_department`, { headers });
      if (userRes.ok) {
        const userData = await userRes.json();
        const users = userData.data || [];
        const deptIds = [...new Set(users.map((u: any) => u.user_department).filter(Boolean))];
        
        let depts: any[] = [];
        if (deptIds.length > 0) {
          const deptRes = await fetch(`${apiBase}/items/department?filter[department_id][_in]=${deptIds.join(",")}&fields=department_id,department_name`, { headers });
          if (deptRes.ok) {
            const deptData = await deptRes.json();
            depts = deptData.data || [];
          }
        }

        employees.forEach((emp: any) => {
          if (!emp.department_name && !emp.department_name_snapshot) {
            const u = users.find((x: any) => x.user_id === emp.user_id);
            if (u && u.user_department) {
              const d = depts.find((x: any) => x.department_id === u.user_department);
              if (d) {
                emp.department_name = d.department_name;
              }
            }
          }
        });
      }
    }

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
