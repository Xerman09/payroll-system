// modules/allowance/components/AllowanceTable.tsx

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit2, CalendarClock, Repeat, Calendar } from "lucide-react";

import type { Allowance, AllowanceMode, User } from "../types";
import {
  flagToBool,
  formatCurrency,
  fullnameFromUser,
} from "../providers/allowanceApi";

import AllowanceTableSkeleton from "./AllowanceTableSkeleton";

interface Props {
  mode: AllowanceMode;

  data: Allowance[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;

  users: User[];

  onPageChange: (newPage: number) => void;
  onEdit: (item: Allowance) => void;
  onDelete: (id: number) => void;
}

export default function AllowanceTable({
  mode,
  data,
  loading,
  total,
  page,
  pageSize,
  users,
  onPageChange,
  onEdit,
  onDelete,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const effectivePage = Math.min(Math.max(page, 1), totalPages);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 dark:bg-gray-800">
            <TableHead className="w-[50px] text-center">#</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Description</TableHead>

            {mode === "one_time" ? (
              <>
                <TableHead>Cutoff Period</TableHead>
                <TableHead>Status</TableHead>
              </>
            ) : (
              <>
                <TableHead>Pay Cycle</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
              </>
            )}

            <TableHead className="text-right w-[120px] pr-6">Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading ? (
            <AllowanceTableSkeleton mode={mode} />
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={mode === "one_time" ? 7 : 9}
                className="h-24 text-center text-muted-foreground"
              >
                No records found.
              </TableCell>
            </TableRow>
          ) : (
            data.map((a, idx) => {
              const idxGlobal = (effectivePage - 1) * pageSize + idx + 1;

              const user = users.find((u) => u.user_id === a.user_id);
              const displayName = user
                ? fullnameFromUser(user)
                : a.user_full_name || `User #${a.user_id}`;

              const isRecurring = flagToBool(a.is_recurring);
              const isActive = flagToBool(a.is_active);

              return (
                <TableRow
                  key={a.allowance_id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="text-center text-muted-foreground text-xs">
                    {idxGlobal}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isRecurring ? (
                        <Repeat className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <CalendarClock className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-medium text-sm">{displayName}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(a.amount)}
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className="font-normal text-xs">
                      {a.description}
                    </Badge>
                  </TableCell>

                  {mode === "one_time" ? (
                    <>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarClock className="w-3.5 h-3.5" />
                          <div className="flex flex-col text-xs">
                            <span>{a.cutoff_start ?? "-"}</span>
                            <span>{a.cutoff_end ?? "-"}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {Number(a.is_processed) === 1 ? (
                          <Badge
                            variant="default"
                            className="bg-green-600/15 text-green-700 hover:bg-green-600/25 border-green-200 shadow-none font-medium"
                          >
                            Processed
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="font-medium text-muted-foreground bg-muted"
                          >
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {a.pay_cycle}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{a.start_date ?? "-"}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{a.end_date ?? "-"}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        {isActive ? (
                          <Badge
                            variant="default"
                            className="bg-green-600/15 text-green-700 hover:bg-green-600/25 border-green-200 shadow-none font-medium"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="font-medium text-muted-foreground bg-muted"
                          >
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                    </>
                  )}

                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5"
                        onClick={() => onEdit(a)}
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => onDelete(a.allowance_id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-4 py-4 border-t">
        <div className="text-xs text-muted-foreground">
          Showing{" "}
          <b>{data.length > 0 ? (effectivePage - 1) * pageSize + 1 : 0}</b> -{" "}
          <b>{Math.min(effectivePage * pageSize, total)}</b> of <b>{total}</b>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(effectivePage - 1)}
            disabled={effectivePage <= 1}
            className="h-8"
          >
            Previous
          </Button>

          <div className="text-xs font-medium px-2">
            Page {effectivePage} of {totalPages}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(effectivePage + 1)}
            disabled={effectivePage >= totalPages}
            className="h-8"
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
