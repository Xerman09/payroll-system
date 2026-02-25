import { NextResponse } from "next/server";

const API_BASE =
  process.env.API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "";

export async function POST(req: Request) {
  try {
    if (!API_BASE) {
      return NextResponse.json(
        { status: "error", message: "API base not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { status: "error", message: "Missing credentials" },
        { status: 400 }
      );
    }

    const deptId = process.env.DEFAULT_DEPT_ID;

    const qs = new URLSearchParams();
    qs.append("limit", "1");
    qs.append("filter[user_email][_eq]", email.trim());
    qs.append("filter[user_department][_eq]", String(deptId));

    const url = `${API_BASE}/items/user?${qs.toString()}`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { status: "error", message: "Backend fetch failed" },
        { status: 500 }
      );
    }

    const json = await res.json();
    const user = json?.data?.[0];

    if (!user) {
      return NextResponse.json(
        { status: "error", reason: "USER_NOT_FOUND" },
        { status: 401 }
      );
    }

    if (String(user.user_password) !== String(password)) {
      return NextResponse.json(
        { status: "password", reason: "PASSWORD_MISMATCH" },
        { status: 401 }
      );
    }

    const { ...safeUser } = user;

    return NextResponse.json({
      status: "success",
      user: safeUser,
    });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}
