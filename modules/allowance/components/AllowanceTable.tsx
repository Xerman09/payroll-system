"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Edit2 } from "lucide-react";
import { Allowance, User } from "../types";

type Props = {
  allowances: Allowance[];
  users: User[];
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onEdit: (a: Allowance) => void;
  onDelete: (id: number) => void;
};

export default function AllowanceTable({
  allowances,
  users,
  page,
  pageSize,
  total,
  loading,
  onEdit,
  onDelete,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const effectivePage = Math.min(Math.max(page, 1), totalPages);

  const formatCurrency = (v: string | number) => {
    const num = typeof v === "string" ? Number(v) : v;
    if (isNaN(num)) return v;
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>No.</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Cutoff</TableHead>
            <TableHead>Processed</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7}>Loading...</TableCell>
            </TableRow>
          ) : allowances.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>No records found.</TableCell>
            </TableRow>
          ) : (
            allowances.map((a, idx) => {
              const idxGlobal = (effectivePage - 1) * pageSize + idx + 1;
              const user = users.find((u) => u.user_id === a.user_id);
              const fullname = user
                ? `${user.user_fname}${
                    user.user_mname ? " " + user.user_mname : ""
                  } ${user.user_lname}`
                : a.user_full_name ?? `User ${a.user_id}`;

              return (
                <TableRow key={a.allowance_id}>
                  <TableCell>{idxGlobal}</TableCell>
                  <TableCell>{fullname}</TableCell>
                  <TableCell>{formatCurrency(a.amount)}</TableCell>
                  <TableCell>{a.description}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{a.cutoff_start}</span>
                      <span className="text-sm text-muted-foreground">
                        {a.cutoff_end}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {Number(a.is_processed) === 1 ? (
                      <Badge>Processed</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" onClick={() => onEdit(a)}>
                      <Edit2 className="w-4 h-4" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDelete(a.allowance_id)}
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
