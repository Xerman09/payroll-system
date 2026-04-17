import { NextResponse } from "next/server";
import { signJWT } from "@/lib/auth";
import { compare } from "bcryptjs";
import { resolveApiConfig } from "@/lib/api-helper";


export async function POST(req: Request) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { status: "error", message: "No enterprise entity selected. Please visit the portal to choose one." },
        { status: 400 }
      );
    }
    const API_BASE = config.apiBase;
    const deptId = config.deptId;
    // ... REST OF THE BODY ...
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { status: "error", message: "Missing credentials" },
        { status: 400 }
      );
    }


    const qs = new URLSearchParams();
    qs.append("limit", "1");
    qs.append("filter[user_email][_eq]", email.trim());
    qs.append("filter[user_department][_eq]", String(deptId));
    qs.append("fields", "*");

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

    let isMatch = false;
    if (user.hash_password) {
      isMatch = await compare(password, user.hash_password);
    } else {
      // Fallback for legacy users whose password is not yet hashed
      isMatch = String(user.user_password) === String(password);
    }

    if (!isMatch) {
      return NextResponse.json(
        { status: "password", reason: "PASSWORD_MISMATCH" },
        { status: 401 }
      );
    }

    // Harden session by picking only safe fields
    const safeUser = {
      user_id: user.user_id,
      user_fname: user.user_fname,
      user_lname: user.user_lname,
      user_mname: user.user_mname,
      user_email: user.user_email,
      role: user.role,
      user_department: user.user_department,
      user_position: user.user_position,
      user_image: user.user_image,
    };

    // Sign into a JWT for tamper-proof transport
    const token = await signJWT(safeUser);

    return NextResponse.json({
      status: "success",
      user: safeUser,
      user_token: token,
    });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}
