import { NextRequest, NextResponse } from "next/server";
import { COMPANIES } from "@/lib/companies";
import { buildForwardHeaders, joinUrl, parseJsonSafe } from "@/lib/api-helper";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const path = body?.path;
    const payload = body?.payload;

    if (!path || !payload) {
      return NextResponse.json({ error: "Missing body.path or body.payload" }, { status: 400 });
    }

    const results: any[] = [];
    const errors: any[] = [];

    // Apply to all companies concurrently
    const promises = COMPANIES.map(async (company) => {
      try {
        let res = await fetch(joinUrl(company.apiBase, path), {
          method: "POST",
          headers: buildForwardHeaders(req, company, { contentType: "application/json", forceServiceToken: true }),
          body: JSON.stringify(payload),
        });

        let data = await parseJsonSafe(res);
        
        // Auto-upsert logic for unique constraint violations on salary_schedules
        if (!res.ok && path.includes("/items/salary_schedules")) {
          const isUniqueError = data?.errors?.some((e: any) => e.message?.toLowerCase().includes("unique"));
          if (isUniqueError && payload.salary_grade && payload.step) {
            // Find existing record
            const queryParams = new URLSearchParams({
              "filter[salary_grade][_eq]": payload.salary_grade,
              "filter[step][_eq]": payload.step,
              "filter[effectivity_date][_eq]": payload.effectivity_date || new Date().toISOString().split("T")[0]
            });
            const searchRes = await fetch(joinUrl(company.apiBase, `/items/salary_schedules?${queryParams.toString()}`), {
              method: "GET",
              headers: buildForwardHeaders(req, company, { forceServiceToken: true })
            });
            const searchData = await parseJsonSafe(searchRes);
            const existingId = searchData?.data?.[0]?.id;
            
            if (existingId) {
              // Patch it instead
              res = await fetch(joinUrl(company.apiBase, `/items/salary_schedules/${existingId}`), {
                method: "PATCH",
                headers: buildForwardHeaders(req, company, { contentType: "application/json", forceServiceToken: true }),
                body: JSON.stringify(payload),
              });
              data = await parseJsonSafe(res);
            }
          }
        }

        if (!res.ok) {
          let errorMsg = data?.error || `HTTP ${res.status}`;
          if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
            errorMsg = data.errors[0]?.message || data.errors[0]?.extensions?.code || errorMsg;
          }
          throw new Error(errorMsg);
        }
        
        results.push({ company: company.name, status: "success", data });
      } catch (error: unknown) {
        const e = error as Error;
        errors.push({ company: company.name, status: "error", error: e?.message });
      }
    });

    await Promise.all(promises);

    if (errors.length > 0) {
      return NextResponse.json({ results, errors, message: "Completed with some errors" }, { status: 207 });
    }

    return NextResponse.json({ results, message: "Applied to all companies successfully" }, { status: 200 });
  } catch (error: unknown) {
    const e = error as Error;
    console.error("API wage apply-all POST error:", e);
    return NextResponse.json(
      { error: e?.message || "POST failed" },
      { status: 500 }
    );
  }
}
