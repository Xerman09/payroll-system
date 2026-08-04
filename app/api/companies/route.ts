import { NextResponse } from "next/server";
import { COMPANIES } from "@/lib/companies";

export const dynamic = "force-dynamic";

export async function GET() {
  // Return only safe fields, excluding tokens and base URLs
  const safeCompanies = COMPANIES.filter(c => !c.hidden).map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    color: c.color,
  }));

  return NextResponse.json(safeCompanies, { status: 200 });
}
