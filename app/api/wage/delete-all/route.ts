import { NextRequest, NextResponse } from "next/server";
import { COMPANIES } from "@/lib/companies";
import { buildForwardHeaders, joinUrl, parseJsonSafe } from "@/lib/api-helper";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const path = body?.path;
    const query = body?.query;

    if (!path || !query) {
      return NextResponse.json({ error: "Missing body.path or body.query" }, { status: 400 });
    }

    const results: any[] = [];
    const errors: any[] = [];

    // Delete from all companies concurrently
    const promises = COMPANIES.map(async (company) => {
      try {
        // 1. Search for the item using the query parameters
        const queryParams = new URLSearchParams();
        Object.keys(query).forEach(key => {
          queryParams.set(`filter[${key}][_eq]`, query[key]);
        });
        
        const searchRes = await fetch(joinUrl(company.apiBase, `${path}?${queryParams.toString()}`), {
          method: "GET",
          headers: buildForwardHeaders(req, company, { forceServiceToken: true })
        });
        const searchData = await parseJsonSafe(searchRes);
        const existingId = searchData?.data?.[0]?.id;

        if (existingId) {
          // 2. If it exists, delete it
          const delRes = await fetch(joinUrl(company.apiBase, `${path}/${existingId}`), {
            method: "DELETE",
            headers: buildForwardHeaders(req, company, { forceServiceToken: true }),
          });

          if (!delRes.ok) {
            const delData = await parseJsonSafe(delRes);
            let errorMsg = delData?.error || `HTTP ${delRes.status}`;
            if (delData?.errors && Array.isArray(delData.errors) && delData.errors.length > 0) {
              errorMsg = delData.errors[0]?.message || delData.errors[0]?.extensions?.code || errorMsg;
            }
            throw new Error(errorMsg);
          }
          
          results.push({ company: company.name, status: "success", deletedId: existingId });
        } else {
          // Item didn't exist, which is fine for a delete-all operation
          results.push({ company: company.name, status: "success", note: "Item not found" });
        }
      } catch (error: unknown) {
        const e = error as Error;
        errors.push({ company: company.name, status: "error", error: e?.message });
      }
    });

    await Promise.all(promises);

    if (errors.length > 0) {
      return NextResponse.json({ results, errors, message: "Completed with some errors" }, { status: 207 });
    }

    return NextResponse.json({ results, message: "Deleted from all companies successfully" }, { status: 200 });
  } catch (error: unknown) {
    const e = error as Error;
    console.error("API wage delete-all POST error:", e);
    return NextResponse.json(
      { error: e?.message || "POST failed" },
      { status: 500 }
    );
  }
}
