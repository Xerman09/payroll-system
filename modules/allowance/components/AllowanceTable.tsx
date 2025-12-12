"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "../utils";
import type { Allowance } from "../types";

const BASE_API = "http://100.126.246.124:8060";

type Props = {
  data: Allowance[];
  loading?: boolean;
  onEdit?: (row: Allowance) => void;
  onDeleteComplete?: () => void;
};

export default function AllowanceTable({
  data,
  loading,
  onEdit,
  onDeleteComplete,
}: Props) {
  const handleDelete = async (id: number) => {
    if (!confirm("Delete this allowance? This action cannot be undone."))
      return;
    try {
      const res = await fetch(`${BASE_API}/items/employee_allowance/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to delete");
      alert("Deleted");
      onDeleteComplete?.();
    } catch (err) {
      console.error(err);
      alert("Failed to delete allowance");
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] md:min-w-[900px] table-auto">
        <thead>
          <tr className="text-left">
            <th className="p-2 md:p-3 text-sm md:text-base">No.</th>
            <th className="p-2 md:p-3 text-sm md:text-base">Name</th>
            <th className="p-2 md:p-3 text-sm md:text-base">Amount</th>
            <th className="p-2 md:p-3 text-sm md:text-base hidden sm:table-cell">
              Description
            </th>
            <th className="p-2 md:p-3 text-sm md:text-base hidden md:table-cell">
              Cut Off
            </th>
            <th className="p-2 md:p-3 text-sm md:text-base">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="p-6">
                Loading...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-6">
                No allowance records found.
              </td>
            </tr>
          ) : (
            data.map((row, idx) => {
              const name =
                (row as any).user_full_name ??
                (row as any).user_name ??
                `User ${row.user_id}`;
              // If user_full_name not provided by API, fallback to user_id
              return (
                <tr key={row.allowance_id} className="border-t">
                  <td className="p-2 md:p-3 align-top text-sm md:text-base">
                    {idx + 1}
                  </td>
                  <td className="p-2 md:p-3 align-top text-sm md:text-base">
                    {name}
                  </td>
                  <td className="p-2 md:p-3 align-top text-sm md:text-base">
                    {formatCurrency(Number(row.amount))}
                  </td>
                  <td className="p-2 md:p-3 align-top text-sm md:text-base hidden sm:table-cell">
                    {row.description}
                  </td>
                  <td className="p-2 md:p-3 align-top text-sm md:text-base hidden md:table-cell">
                    {formatDate(row.cutoff_start)} -{" "}
                    {formatDate(row.cutoff_end)}
                  </td>
                  <td className="p-2 md:p-3 align-top flex gap-1 md:gap-2">
                    <Button size="sm" onClick={() => onEdit?.(row)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(Number(row.allowance_id))}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
