"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  TableHead,
} from "@/components/ui/table";
import { Edit, Trash2 } from "lucide-react";

import type { Membership, SortConfig, TabContentProps, User } from "../types";
import { formatPeso } from "../helpers";
import { listItems, deleteItem } from "../providers/coopApi";
import { SortableHeader } from "./SortableHeader";
import { AddEmployeeModal } from "./modals/AddEmployeeModal";
import { EditEmployeeModal } from "./modals/EditEmployeeModal";
import { CoopTableSkeleton } from "./CoopTableSkeleton";

const SavingsTab = forwardRef<{ getData: () => unknown[] }, TabContentProps>(
  function SavingsTab(
    {
      searchTerm,
      statusFilter,
      refreshTrigger,
      isAddModalOpen,
      onCloseAddModal,
    },
    ref
  ) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingMembership, setEditingMembership] = useState<Membership | null>(
    null
  );

  const rowsPerPage = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalMemberships, setTotalMemberships] = useState<number>(0);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  useImperativeHandle(ref, () => ({
    getData: () => processedRows,
  }));

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const offset = (currentPage - 1) * rowsPerPage;

        const { data: membershipList, meta } = await listItems<Membership>(
          "coop_savings_membership",
          {
            limit: String(rowsPerPage),
            offset: String(offset),
            meta: "filter_count",
          },
          signal
        );

        if (signal?.aborted) return;

        const total: number =
          (meta?.filter_count as number) ?? (meta?.total as number) ?? membershipList.length;
        setMemberships(membershipList);
        setTotalMemberships(total);

        const userIds = Array.from(
          new Set(membershipList.map((m) => Number(m.user_id)).filter(Boolean))
        );

        let userList: User[] = [];
        if (userIds.length > 0) {
          const ur = await listItems<User>(
            "user",
            {
              limit: String(userIds.length),
              ["filter[user_id][_in]"]: userIds.join(","),
            },
            signal
          );
          userList = ur.data;
        }

        if (signal?.aborted) return;
        setUsers(userList);
      } catch (err: unknown) {
        const e = err as Error;
        if (e?.name === "AbortError") return;
        console.error(err);
        setError("Failed to load savings or users.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [currentPage]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData, refreshTrigger]);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const processedRows = useMemo(() => {
    let data = memberships.map((m) => {
      const user = users.find((u) => Number(u.user_id) === Number(m.user_id));
      const name = user
        ? `${user.user_fname} ${user.user_lname}`
        : `User #${m.user_id}`;

      // ✅ Use stored DB values only. Payroll Run updates these.
      const mRecord = m as unknown as Record<string, unknown>;
      const monthly = Number(mRecord?.monthly_amount ?? 0);
      const totalMonths = Number(mRecord?.total_months ?? 0);
      const totalCollection = Number(mRecord?.total_collection ?? 0);

      const start = m.start_date || null;
      const end = m.end_date || null;
      const membershipId = String(mRecord?.membership_id ?? "-");

      return {
        id: m.id,
        membershipId,
        name,
        monthly,
        totalMonths,
        totalCollection,
        start,
        end,
        raw: m,
      };
    });

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(
        (row) =>
          row.name.toLowerCase().includes(lower) ||
          String(row.membershipId).toLowerCase().includes(lower)
      );
    }

    if (statusFilter !== "All") {
      if (statusFilter === "Inactive") {
        data = data.filter((row) => row.raw.is_active === 0);
      } else {
        data = data.filter((row) => row.raw.is_active === 1);
      }
    }

    if (sortConfig) {
      data.sort((a, b) => {
        const key = sortConfig.key as keyof typeof a;
        const aVal = (a[key] ?? "") as string | number;
        const bVal = (b[key] ?? "") as string | number;
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [memberships, users, searchTerm, statusFilter, sortConfig]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this membership?")) return;
    try {
      await deleteItem("coop_savings_membership", id);
      setMemberships((prev) => prev.filter((m) => m.id !== id));
      setTotalMemberships((prev) => Math.max(0, prev - 1));
      toast.success("Deleted successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete membership.");
    }
  };

  const handleEdited = (updatedMembership: Membership) => {
    setMemberships((prev) =>
      prev.map((m) => (m.id === updatedMembership.id ? updatedMembership : m))
    );
    setEditingMembership(null);
  };

  const totalPages = Math.max(1, Math.ceil(totalMemberships / rowsPerPage));
  const startRow = (currentPage - 1) * rowsPerPage + 1;
  const endRow = Math.min(currentPage * rowsPerPage, totalMemberships);

  return (
    <>
      <div className="rounded-md border bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50">{error}</div>
        )}

        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-900/50">
            <TableRow>
              <TableHead className="w-[50px] text-xs font-semibold uppercase tracking-wider">
                No.
              </TableHead>

              <SortableHeader
                label="Membership ID"
                sortKey="membershipId"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-xs font-semibold uppercase tracking-wider"
              />

              <SortableHeader
                label="Name"
                sortKey="name"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-xs font-semibold uppercase tracking-wider"
              />

              <SortableHeader
                label="Collection/Month"
                sortKey="monthly"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-xs font-semibold uppercase tracking-wider"
              />

              <SortableHeader
                label="Total Collection"
                sortKey="totalCollection"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-xs font-semibold uppercase tracking-wider"
              />

              <SortableHeader
                label="Total Months"
                sortKey="totalMonths"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-xs font-semibold uppercase tracking-wider"
              />

              <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">
                Status
              </TableHead>

              <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">
                Action
              </TableHead>

              <TableHead className="text-xs font-semibold uppercase tracking-wider">
                Start Date
              </TableHead>

              <TableHead className="text-xs font-semibold uppercase tracking-wider">
                End Date
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <CoopTableSkeleton type="savings" />
            ) : processedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="h-24 text-center text-muted-foreground"
                >
                  No savings members found.
                </TableCell>
              </TableRow>
            ) : (
              processedRows.map((r, idx) => (
                <TableRow
                  key={r.id ?? idx}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <TableCell className="font-medium text-gray-500">
                    {startRow + idx}
                  </TableCell>

                  <TableCell className="font-mono text-gray-700 dark:text-gray-300">
                    {r.membershipId}
                  </TableCell>

                  <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                    {r.name}
                  </TableCell>

                  <TableCell className="font-mono text-gray-600 dark:text-gray-400">
                    {formatPeso(r.monthly)}
                  </TableCell>

                  <TableCell className="font-mono text-emerald-600 dark:text-emerald-400">
                    {formatPeso(r.totalCollection)}
                  </TableCell>

                  <TableCell>{r.totalMonths}</TableCell>

                  <TableCell className="text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        r.raw.is_active === 1
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {r.raw.is_active === 1 ? "Active" : "Inactive"}
                    </span>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingMembership(r.raw)}
                        className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5"
                      >
                        <Edit size={14} />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(r.id)}
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>

                  <TableCell className="text-gray-500 text-sm">
                    {r.start ?? "-"}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {r.end ?? "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-500">
          Showing{" "}
          <span className="font-medium">
            {totalMemberships > 0 ? startRow : 0}
          </span>{" "}
          to <span className="font-medium">{endRow}</span> of{" "}
          <span className="font-medium">{totalMemberships}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            Prev
          </Button>

          <span className="text-sm text-gray-600">
            Page {currentPage} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      <AddEmployeeModal
        isOpen={isAddModalOpen}
        onClose={onCloseAddModal}
        onAdded={(newMem) => {
          setMemberships((prev) => [newMem, ...prev]);
          setTotalMemberships((prev) => prev + 1);
          onCloseAddModal();
        }}
      />

      <EditEmployeeModal
        isOpen={!!editingMembership}
        membership={editingMembership}
        users={users}
        onClose={() => setEditingMembership(null)}
        onEdited={handleEdited}
      />
    </>
  );
});

export default SavingsTab;
