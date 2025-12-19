// app/api/payroll/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // 'employees' or 'departments'

  // Get the base URL from env
  const API_BASE = process.env.API_BASE;

  if (!API_BASE) {
    return NextResponse.json(
      { error: "API_BASE is not defined" },
      { status: 500 }
    );
  }

  let endpoint = "";

  // Determine which external endpoint to hit based on the query param
  switch (type) {
    case "employees":
      endpoint = "/items/user";
      break;
    case "departments":
      endpoint = "/items/department";
      break;
    default:
      return NextResponse.json(
        { error: "Invalid type parameter. Use 'employees' or 'departments'" },
        { status: 400 }
      );
  }

  try {
    // Server-side fetch (bypasses CORS)
    const res = await fetch(`${API_BASE}${endpoint}`, {
      cache: "no-store", // Ensure we always get fresh data for payroll
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`External API error: ${res.statusText}`);
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Payroll API Proxy Error: - route.ts:52", error);
    return NextResponse.json(
      { error: "Failed to fetch data from external API" },
      { status: 500 }
    );
  }
}