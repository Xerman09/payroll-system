import { NextResponse } from "next/server";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";
import { buildPayslipsPdf } from "@/modules/payroll-run/utils/payslipPdf";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const { empIds, cutoffId, sentBy } = await request.json();
    if (!empIds || empIds.length === 0) {
      return NextResponse.json({ error: "No employees selected" }, { status: 400 });
    }

    const config = await resolveApiConfig();
    const apiBase = config?.apiBase;
    if (!apiBase) {
      return NextResponse.json({ error: "No API base configured" }, { status: 500 });
    }

    const headers = buildForwardHeaders(request, config, { forceServiceToken: true, contentType: "application/json" });
    const getHeaders = buildForwardHeaders(request, config, { forceServiceToken: true });

    // 1. Fetch cutoff to get dates (or just run)
    // We can fetch the employees to get their details
    const empQuery = new URLSearchParams({
      "filter[id][_in]": empIds.join(","),
      "limit": "-1"
    });

    const empRes = await fetch(`${apiBase}/items/payroll_run_employee?${empQuery.toString()}`, { headers: getHeaders });
    if (!empRes.ok) throw new Error("Failed to fetch employees");
    const empData = await empRes.json();
    const employees = empData.data || [];

    if (employees.length === 0) {
      return NextResponse.json({ error: "Employees not found" }, { status: 404 });
    }

    // Get run details
    const runRes = await fetch(`${apiBase}/items/payroll_run/${employees[0].payroll_run_id}`, { headers: getHeaders });
    const runData = await runRes.json();
    const run = runData.data;
    const payrollPeriodLabel = run ? `${run.cutoff_start || ''} to ${run.cutoff_end || ''}` : "Unknown";

    // Setup nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.mailtrap.io",
      port: Number(process.env.SMTP_PORT) || 2525,
      auth: {
        user: process.env.SMTP_USER || "user",
        pass: process.env.SMTP_PASS || "pass",
      },
    });

    const results = [];

    // Process each employee
    for (const emp of employees) {
      try {
        // Fetch user email
        const userRes = await fetch(`${apiBase}/items/user/${emp.user_id}?fields=user_email`, { headers: getHeaders });
        const userData = await userRes.json();
        const userEmail = userData?.data?.user_email;

        if (!userEmail) {
          results.push({ id: emp.id, success: false, error: "No email found" });
          continue;
        }

        // Generate PDF
        const doc = await buildPayslipsPdf({
          rows: [emp],
          payrollPeriodLabel,
          payrollRefNo: run?.payroll_ref_no,
          postedAt: run?.date_updated || run?.date_created
        });

        const pdfBuffer = Buffer.from(doc.output("arraybuffer") as ArrayBuffer);

        // Send Email
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"Payroll" <payroll@company.com>',
          to: userEmail,
          subject: `Payslip for ${payrollPeriodLabel}`,
          text: `Hi ${emp.employee_name},\n\nPlease find attached your payslip for the period ${payrollPeriodLabel}.\n\nBest Regards,\nHR/Payroll`,
          attachments: [
            {
              filename: `Payslip_${emp.employee_name.replace(/\s+/g, "_")}.pdf`,
              content: pdfBuffer,
            },
          ],
        });

        // Update database
        const patchRes = await fetch(`${apiBase}/items/payroll_run_employee/${emp.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            is_payslip_sent: 1,
            payslip_sent_at: new Date().toISOString(),
            payslip_sent_by: sentBy || null
          })
        });

        if (!patchRes.ok) {
           console.error("Failed to update status for emp", emp.id);
        }

        results.push({ id: emp.id, success: true });
      } catch (e: any) {
        results.push({ id: emp.id, success: false, error: e.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Payslip Dispatch Send API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
