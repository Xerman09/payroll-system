import React from "react";
import type { User } from "@/modules/additions-deductions/types";

function fullname(u?: User | null) {
  if (!u) return "Unknown";
  return `${u.user_fname} ${u.user_mname ? u.user_mname + " " : ""}${u.user_lname}`;
}

export default function EmployeeNameInternal({
  userId,
  userMap,
}: {
  userId: number;
  userMap: Map<number, User>;
}) {
  const u = userMap.get(Number(userId));
  if (!u) return <span className="text-gray-400">Unknown (ID: {userId})</span>;
  return <span>{fullname(u)}</span>;
}
