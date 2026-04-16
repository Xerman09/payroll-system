import { NextResponse } from "next/server";
import { COMPANIES } from "@/lib/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Filter out hidden companies (like the dummy one)
    const activeEntities = COMPANIES.filter(c => !c.hidden).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      color: c.color,
      // We don't expose apiBase or deptId to the client for security, 
      // but they are available on the server via lib/companies.ts
    }));

    return NextResponse.json({
      success: true,
      data: activeEntities,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to fetch entities" },
      { status: 500 }
    );
  }
}
