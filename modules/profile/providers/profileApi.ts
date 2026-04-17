"use client";

import bcrypt from "bcryptjs";

const BASE_API = "/api/profile";

async function apiFetch(path: string, options?: RequestInit) {
  const url = `${BASE_API}?path=${encodeURIComponent(path)}`;
  
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options?.headers || {}),
    },
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  }

  return json;
}

/**
 * Fetch a specific user profile by ID
 */
export async function fetchUserProfile(userId: string | number) {
  const json = await apiFetch(`/items/user/${userId}?fields=*,user_department.*`);
  return json.data;
}

/**
 * Update user profile information
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateUserProfile(userId: string | number, payload: Record<string, any>) {
  const res = await fetch(BASE_API, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: `/items/user/${userId}`,
      payload,
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || json?.error || "Update failed");
  return json.data;
}

/**
 * Upload a profile image to Directus
 */
export async function uploadProfileImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_API}?path=/files`, {
    method: "POST",
    body: formData,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || json?.error || "Upload failed");
  return json.data;
}

/**
 * Update user password with hashing
 */
export async function updatePassword(userId: string | number, newPassword: string) {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(newPassword, salt);

  return updateUserProfile(userId, {
    user_password: newPassword, // Keeping existing field if used for legacy
    hash_password: hash,        // Modern hashed password
  });
}

/**
 * Verify current password by attempting a login
 */
export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();
    return res.ok && json.status === "success";
  } catch (error) {
    console.error("Verification error:", error);
    return false;
  }
}

/**
 * Fetch list of departments
 */
export async function fetchDepartments() {
  const json = await apiFetch("/items/department?limit=-1");
  return json.data || [];
}

/**
 * Search for employees by name, ID, or position
 */
export async function searchEmployees(query: string) {
  if (!query || query.length < 2) return [];
  const json = await apiFetch(`/items/user?fields=user_id,user_fname,user_lname,user_image,user_position&search=${encodeURIComponent(query)}&limit=8`);
  return json.data || [];
}
