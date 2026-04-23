import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { resolveApiConfig, buildForwardHeaders } from "@/lib/api-helper";

export async function POST(req: Request) {
  try {
    const config = await resolveApiConfig();
    if (!config) {
      return NextResponse.json(
        { status: "error", message: "No enterprise entity selected." },
        { status: 400 }
      );
    }
    const API_BASE = config.apiBase;
    const { userId, password } = await req.json();

    if (!userId || !password) {
      return NextResponse.json(
        { status: "error", message: "Missing credentials" },
        { status: 400 }
      );
    }

    const fields = [
      "user_id",
      "user_fname",
      "user_mname",
      "user_lname",
      "user_email",
      "user_password",
      "hash_password",
      "role",
      "user_department",
      "user_position",
      "user_image",
    ].join(",");

    const res = await fetch(`${API_BASE}/items/user/${userId}?fields=${fields}`, {
      cache: "no-store",
      // Use the company/service token — request specific fields only, never wildcard with a token.
      headers: buildForwardHeaders(req, config, { forceServiceToken: true }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { status: "error", message: "User not found" },
        { status: 404 }
      );
    }

    const { data: user } = await res.json();

    if (!user) {
      return NextResponse.json(
        { status: "error", message: "User record not found" },
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
        { status: "error", message: "Incorrect password" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      status: "success",
      message: "Password verified",
    });
  } catch (error) {
    console.error("[VerifyPassword] Error:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}
