import { SignJWT, jwtVerify, type JWTPayload as JosePayload } from "jose";

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "payroll_system_default_secret_key_2026"
);

export interface JWTPayload {
  user_id: string | number;
  user_fname: string;
  user_lname: string;
  user_mname?: string;
  user_email: string;
  role: string;
  user_department: string | number;
  user_position: string;
  user_image?: string;
  [key: string]: unknown;
}

/**
 * Sign a user object into a JWT token.
 */
export async function signJWT(payload: JWTPayload) {
  return await new SignJWT(payload as JosePayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m") // Reduced to 15 minutes per user request
    .sign(SECRET_KEY);
}

/**
 * Verify a JWT token and return the payload.
 */
export async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Decode a JWT token WITHOUT verification (for UI convenience).
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

/**
 * Client-side helper to get the currently logged-in user from the token.
 */
export function getLoggedUser(): JWTPayload | null {
  if (typeof window === "undefined") return null;
  const token = sessionStorage.getItem("user_token");
  if (!token) return null;
  return decodeJWT(token);
}
