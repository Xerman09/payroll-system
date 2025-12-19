"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Edit,
  Trash2,
  ArrowUpDown,
  RefreshCw,
  RotateCcw,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Internal API Route
const INTERNAL_API = "/api/coop";

/* --------------------------
   Type Definitions
-------------------------- */
interface Membership {
  id: number;
  user_id: number;
  monthly_amount: number;
  start_date: string | null;
  end_date: string | null;
  is_active: number;
  created_by: number;
}

interface User {
  user_id: number;
  user_fname: string;
  user_lname: string;
  is_deleted?: boolean | { data: [number] };
  isDeleted?: boolean;
  deleted?: boolean;
}

interface EmployeeLoan {
  loan_id: number;
  user_id: number;
  loan_amount: number;
  interest_rate: number;
  interest_amount: number;
  net_amount_released: number;
  months_to_pay: number;
  monthly_payment: number;
  start_date: string;
  end_date: string | null;
  status: "ACTIVE" | "PAID" | "CANCELLED";
  created_by?: number;
  created_date?: string;
  updated_by?: number | null;
  updated_date?: string | null;
}

interface LoanPayment {
  id?: number;
  loan_id?: number;
  amount?: string | number;
  payment_date?: string;
}

type LoanRowData = {
  loan: EmployeeLoan;
  name: string;
  loanAmount: number;
  totalPaid: number;
  balance: number;
};

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
} | null;

interface TabContentProps {
  searchTerm: string;
  statusFilter: string;
  refreshTrigger: number;
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
}

/* --------------------------
   Helpers
-------------------------- */
function formatPeso(n: number | string): string {
  const num = Number(n || 0);
  return `₱${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function monthsBetweenInclusive(
  start: string | null,
  end: string | null
): number {
  if (!start) return 0;
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const yearDiff = endDate.getFullYear() - startDate.getFullYear();
  const monthDiff = endDate.getMonth() - startDate.getMonth();
  const totalMonths = yearDiff * 12 + monthDiff;
  return totalMonths + 1; // inclusive
}

const SortableHeader = ({
  label,
  sortKey,
  currentSort,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: string;
  currentSort: SortConfig;
  onSort: (key: string) => void;
  className?: string;
}) => {
  return (
    <TableHead
      className={`cursor-pointer hover:bg-gray-50 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div
        className={`flex items-center gap-2 ${
          className.includes("text-right") ? "justify-end" : "justify-start"
        }`}
      >
        {label}
        <ArrowUpDown
          size={14}
          className={
            currentSort?.key === sortKey ? "opacity-100" : "opacity-30"
          }
        />
      </div>
    </TableHead>
  );
};

/* --------------------------
   Main Coop Page
-------------------------- */
export default function CoopPage() {
  const [activeTab, setActiveTab] = useState("savings");

  // Lifted State for Shared Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleReset = () => {
    setSearchTerm("");
    setStatusFilter("All");
    toast.info("Filters reset");
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* 1. Header Row - MOVED OUTSIDE CARD */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              COOP Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === "savings"
                ? "Manage employee savings records and collections."
                : "Track employee loans, payments, and balances."}
            </p>
          </div>

          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            {activeTab === "savings" ? "Add Employee" : "Add Loan"}
          </Button>
        </div>
        <Separator />

        {/* 2. Main Content Card */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <CardContent className="p-6 space-y-6">
            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Search */}
              <div className="md:col-span-5 space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Search employee
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="md:col-span-3 space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Processed / Status
                </Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    {activeTab === "loans" && (
                      <SelectItem value="PAID">Paid</SelectItem>
                    )}
                    {activeTab === "loans" && (
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    )}
                    {activeTab === "savings" && (
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Quick Actions */}
              <div className="md:col-span-4 space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Quick Actions
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleReset}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reset
                  </Button>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleRefresh}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-2" /> Refresh
                  </Button>
                </div>
              </div>
            </div>

            {/* Tabs & Content */}
            <Tabs
              value={activeTab}
              onValueChange={(val) => {
                setActiveTab(val);
                handleReset(); // Optional: reset filters on tab switch
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="savings">Savings Management</TabsTrigger>
                <TabsTrigger value="loans">Loans Management</TabsTrigger>
              </TabsList>

              <TabsContent value="savings" className="mt-0 space-y-4">
                <SavingsTab
                  searchTerm={searchTerm}
                  statusFilter={statusFilter}
                  refreshTrigger={refreshTrigger}
                  isAddModalOpen={isAddModalOpen && activeTab === "savings"}
                  onCloseAddModal={() => setIsAddModalOpen(false)}
                />
              </TabsContent>

              <TabsContent value="loans" className="mt-0 space-y-4">
                <LoansTab
                  searchTerm={searchTerm}
                  statusFilter={statusFilter}
                  refreshTrigger={refreshTrigger}
                  isAddModalOpen={isAddModalOpen && activeTab === "loans"}
                  onCloseAddModal={() => setIsAddModalOpen(false)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

/* --------------------------
   Loans Tab Component
-------------------------- */
function LoansTab({
  searchTerm,
  statusFilter,
  refreshTrigger,
  isAddModalOpen,
  onCloseAddModal,
}: TabContentProps) {
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [paymentsMap, setPaymentsMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLoan, setEditingLoan] = useState<EmployeeLoan | null>(null);

  const rowsPerPage = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalLoans, setTotalLoans] = useState<number>(0);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const loansUrl = `${INTERNAL_API}?collection=employee_loan&limit=${rowsPerPage}&offset=${
          (currentPage - 1) * rowsPerPage
        }&meta=filter_count`;

        const lr = await fetch(loansUrl, { signal });
        if (!lr.ok) {
          throw new Error(lr.status === 503 ? "Server busy." : await lr.text());
        }

        const ljson = await lr.json();
        const loanList: EmployeeLoan[] = Array.isArray(ljson?.data)
          ? ljson.data
          : [];
        const total: number =
          ljson?.meta?.filter_count ?? ljson?.meta?.total ?? loanList.length;

        if (signal?.aborted) return;
        setLoans(loanList);
        setTotalLoans(total);

        const userIds = Array.from(
          new Set(loanList.map((ln) => Number(ln.user_id)).filter(Boolean))
        );
        const loanIds = loanList
          .map((ln) => Number(ln.loan_id))
          .filter(Boolean);

        let userList: User[] = [];
        if (userIds.length > 0) {
          const usersUrl = `${INTERNAL_API}?collection=user&limit=${
            userIds.length
          }&filter[user_id][_in]=${userIds.join(",")}`;
          const ur = await fetch(usersUrl, { signal });
          if (ur.ok) {
            const ujson = await ur.json();
            userList = Array.isArray(ujson?.data) ? ujson.data : [];
          }
        }
        if (signal?.aborted) return;
        setUsers(userList);

        const map: Record<number, number> = {};
        if (loanIds.length > 0) {
          const payUrl = `${INTERNAL_API}?collection=employee_loan_payment&limit=-1&filter[loan_id][_in]=${loanIds.join(
            ","
          )}`;
          const pr = await fetch(payUrl, { signal });
          if (pr.ok) {
            const pjson = await pr.json();
            const paymentsList: LoanPayment[] = Array.isArray(pjson?.data)
              ? pjson.data
              : [];
            for (const p of paymentsList) {
              const lid = Number(p.loan_id);
              const amt = Number(p.amount || 0);
              if (!lid) continue;
              map[lid] = (map[lid] || 0) + amt;
            }
          }
        }
        if (signal?.aborted) return;
        setPaymentsMap(map);
      } catch (err: unknown) {
        const errorObj = err as Error;
        if (errorObj.name === "AbortError") return;
        console.error(err);
        setError("Failed to load data.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [currentPage, rowsPerPage]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData, refreshTrigger]);

  const getUserName = useCallback(
    (userId: number) => {
      const user = users.find((u) => Number(u.user_id) === Number(userId));
      return user ? `${user.user_fname} ${user.user_lname}` : `User #${userId}`;
    },
    [users]
  );

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

  const handleDeleteLoan = async (loanId: number) => {
    if (!confirm("Are you sure you want to delete this loan?")) return;
    try {
      const res = await fetch(
        `${INTERNAL_API}?collection=employee_loan&id=${loanId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(await res.text());
      setLoans(loans.filter((l) => l.loan_id !== loanId));
      toast.success("Deleted successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete loan.");
    }
  };

  const processedRows = useMemo(() => {
    let data: LoanRowData[] = loans.map((ln) => {
      const loanAmount = Number(ln.loan_amount || 0);
      const totalPaid = paymentsMap[Number(ln.loan_id)] ?? 0;
      const balance = Math.max(0, loanAmount - totalPaid);
      const name = getUserName(ln.user_id);
      return { loan: ln, name, loanAmount, totalPaid, balance };
    });

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter((row) => row.name.toLowerCase().includes(lower));
    }
    if (statusFilter !== "All") {
      data = data.filter((row) => row.loan.status === statusFilter);
    }

    if (sortConfig) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof LoanRowData];
        const bVal = b[sortConfig.key as keyof LoanRowData];
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [loans, paymentsMap, getUserName, searchTerm, statusFilter, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(totalLoans / rowsPerPage));
  const startRow = (currentPage - 1) * rowsPerPage + 1;
  const endRow = Math.min(currentPage * rowsPerPage, totalLoans);

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
                label="Name"
                sortKey="name"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-xs font-semibold uppercase tracking-wider"
              />
              <SortableHeader
                label="Total Loan"
                sortKey="loanAmount"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right text-xs font-semibold uppercase tracking-wider"
              />
              <SortableHeader
                label="Total Paid"
                sortKey="totalPaid"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right text-xs font-semibold uppercase tracking-wider"
              />
              <SortableHeader
                label="Total Balance"
                sortKey="balance"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right text-xs font-semibold uppercase tracking-wider"
              />
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">
                Cutoff Payment
              </TableHead>
              <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">
                Status
              </TableHead>
              <TableHead className="text-center text-xs font-semibold uppercase tracking-wider">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell
                    colSpan={8}
                    className="h-12 text-center text-gray-400"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ))
            ) : processedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              processedRows.map((row, idx) => (
                <TableRow
                  key={row.loan.loan_id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <TableCell className="font-medium text-gray-500">
                    {startRow + idx}
                  </TableCell>
                  <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                    {row.name}
                  </TableCell>
                  <TableCell className="text-right text-gray-600 dark:text-gray-400 font-mono">
                    {formatPeso(row.loanAmount)}
                  </TableCell>
                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatPeso(row.totalPaid)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-gray-900 dark:text-gray-100 font-mono">
                    {formatPeso(row.balance)}
                  </TableCell>
                  <TableCell className="text-right text-gray-600 dark:text-gray-400 font-mono">
                    {formatPeso(row.loan.monthly_payment)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.loan.status === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : row.loan.status === "PAID"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {row.loan.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingLoan(row.loan)}
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteLoan(row.loan.loan_id)}
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
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
          <span className="font-medium">{totalLoans > 0 ? startRow : 0}</span>{" "}
          to <span className="font-medium">{endRow}</span> of{" "}
          <span className="font-medium">{totalLoans}</span>
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

      {isAddModalOpen && (
        <AddLoanModal
          availableUsers={users}
          onClose={onCloseAddModal}
          onCreate={(loan) => {
            setLoans([loan, ...loans]);
            onCloseAddModal();
          }}
        />
      )}

      {editingLoan && (
        <EditLoanModal
          loan={editingLoan}
          onClose={() => setEditingLoan(null)}
          onUpdated={(updated) => {
            setLoans(
              loans.map((l) => (l.loan_id === updated.loan_id ? updated : l))
            );
            setEditingLoan(null);
          }}
        />
      )}
    </>
  );
}

/* --------------------------
   Savings Tab Component
-------------------------- */
function SavingsTab({
  searchTerm,
  statusFilter,
  refreshTrigger,
  isAddModalOpen,
  onCloseAddModal,
}: TabContentProps) {
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

  const loadData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const msUrl = `${INTERNAL_API}?collection=coop_savings_membership&limit=${rowsPerPage}&offset=${
          (currentPage - 1) * rowsPerPage
        }&meta=filter_count`;
        const mr = await fetch(msUrl, { signal });
        if (!mr.ok)
          throw new Error(mr.status === 503 ? "Server busy." : await mr.text());

        const mjson = await mr.json();
        const membershipList: Membership[] = Array.isArray(mjson?.data)
          ? mjson.data
          : [];
        const total: number =
          mjson?.meta?.filter_count ??
          mjson?.meta?.total ??
          membershipList.length;

        if (signal?.aborted) return;
        setMemberships(membershipList);
        setTotalMemberships(total);

        const userIds = Array.from(
          new Set(membershipList.map((m) => Number(m.user_id)).filter(Boolean))
        );
        let userList: User[] = [];
        if (userIds.length > 0) {
          const uUrl = `${INTERNAL_API}?collection=user&limit=${
            userIds.length
          }&filter[user_id][_in]=${userIds.join(",")}`;
          const ur = await fetch(uUrl, { signal });
          if (ur.ok) {
            const ujson = await ur.json();
            userList = Array.isArray(ujson?.data) ? ujson.data : [];
          }
        }
        if (signal?.aborted) return;
        setUsers(userList);
      } catch (err: unknown) {
        const errorObj = err as Error;
        if (errorObj.name === "AbortError") return;
        console.error(err);
        setError("Failed to load savings or users.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [currentPage, rowsPerPage]
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
      const monthly = Number(m.monthly_amount ?? 0);
      const start = m.start_date || null;
      const end = m.end_date || null;
      const months = monthsBetweenInclusive(start, end);
      const totalCollection = monthly * months;
      return {
        id: m.id,
        name,
        monthly,
        months,
        totalCollection,
        start,
        end,
        raw: m,
      };
    });

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter((row) => row.name.toLowerCase().includes(lower));
    }

    if (statusFilter !== "All") {
      const isActive = statusFilter === "Active" ? 1 : 0;
      if (statusFilter === "Inactive") {
        data = data.filter((row) => row.raw.is_active === 0);
      } else {
        data = data.filter((row) => row.raw.is_active === 1);
      }
    }

    if (sortConfig) {
      data.sort((a, b) => {
        const key = sortConfig.key as keyof typeof a;
        const aVal = a[key] ?? "";
        const bVal = b[key] ?? "";
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
      const res = await fetch(
        `${INTERNAL_API}?collection=coop_savings_membership&id=${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(await res.text());
      setMemberships((prev) => prev.filter((m) => m.id !== id));
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
                sortKey="months"
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
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell
                    colSpan={9}
                    className="h-12 text-center text-gray-400"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ))
            ) : processedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
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
                  <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                    {r.name}
                  </TableCell>
                  <TableCell className="font-mono text-gray-600 dark:text-gray-400">
                    {formatPeso(r.monthly)}
                  </TableCell>
                  <TableCell className="font-mono text-emerald-600 dark:text-emerald-400">
                    {formatPeso(r.totalCollection)}
                  </TableCell>
                  <TableCell>{r.months}</TableCell>
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
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
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

      {isAddModalOpen && (
        <AddEmployeeModal
          availableUsers={users}
          onClose={onCloseAddModal}
          onAdded={(newMem) => {
            setMemberships([newMem, ...memberships]);
            onCloseAddModal();
          }}
        />
      )}

      {editingMembership && (
        <EditEmployeeModal
          membership={editingMembership}
          users={users}
          onClose={() => setEditingMembership(null)}
          onEdited={handleEdited}
        />
      )}
    </>
  );
}

// ... AddEmployeeModal, EditEmployeeModal, AddLoanModal, EditLoanModal remain strictly unchanged ...
// NOTE: Please ensure the rest of your file (the Modal components) is pasted here as is,
// as I have not modified them but they are required for the module to work.

/* --------------------------
   AddEmployeeModal (Savings)
-------------------------- */
function AddEmployeeModal({
  availableUsers = [],
  onClose,
  onAdded,
}: {
  availableUsers: User[];
  onClose: () => void;
  onAdded: (newMembership: Membership) => void;
}) {
  const [userId, setUserId] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return availableUsers;
    const s = searchTerm.toLowerCase();
    return availableUsers.filter((u) => {
      const full = `${u.user_fname} ${u.user_lname}`.toLowerCase();
      return full.includes(s) || String(u.user_id).includes(s);
    });
  }, [searchTerm, availableUsers]);

  // Auto-select if there's exactly one match
  useEffect(() => {
    if (filteredUsers.length === 1 && searchTerm.trim()) {
      setUserId(String(filteredUsers[0].user_id));
    } else if (filteredUsers.length === 0 || !searchTerm.trim()) {
      setUserId("");
    }
  }, [filteredUsers, searchTerm]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!userId) return setError("Please select an employee.");
    if (!monthlyAmount || Number(monthlyAmount) <= 0)
      return setError("Please enter a valid monthly amount.");
    if (!startDate) return setError("Please select a start date.");
    if (endDate && new Date(endDate) < new Date(startDate))
      return setError("End date cannot be before start date.");

    const loggedUser = sessionStorage.getItem("user");
    const loggedUserId = loggedUser ? JSON.parse(loggedUser).user_id : 1;

    const payload = {
      user_id: Number(userId),
      monthly_amount: Number(monthlyAmount),
      start_date: startDate,
      end_date: endDate || null,
      is_active: 1,
      created_by: Number(loggedUserId),
    };

    setSubmitting(true);
    try {
      // REFACTOR: Use internal API
      const res = await fetch(
        `${INTERNAL_API}?collection=coop_savings_membership`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onAdded(data?.data || data);
      toast.success("Member added successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to add member.");
      toast.error("Failed to add member.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-md p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Add Employee to COOP Savings
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Search employee
            </label>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type name or id to filter"
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Select Employee
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">-- Select employee --</option>
              {filteredUsers.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.user_fname} {u.user_lname}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Amount to be paid per month
            </label>
            <input
              type="number"
              step="0.01"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="e.g. 1000.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                End Date (optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-200 text-gray-700"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-persian-blue-800 text-white"
              disabled={submitting}
            >
              {submitting ? "Adding..." : "Add Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* --------------------------
   EditEmployeeModal (Savings)
-------------------------- */
function EditEmployeeModal({
  membership,
  users,
  onClose,
  onEdited,
}: {
  membership: Membership;
  users: User[];
  onClose: () => void;
  onEdited: (updatedMembership: Membership) => void;
}) {
  const [userId, setUserId] = useState(String(membership.user_id));
  const [monthlyAmount, setMonthlyAmount] = useState(
    String(membership.monthly_amount)
  );
  const [startDate, setStartDate] = useState(membership.start_date || "");
  const [endDate, setEndDate] = useState(membership.end_date || "");
  const [isActive, setIsActive] = useState(membership.is_active);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!userId) return setError("Please select an employee.");
    if (!monthlyAmount || Number(monthlyAmount) <= 0)
      return setError("Please enter a valid monthly amount.");
    if (!startDate) return setError("Please select a start date.");
    if (endDate && new Date(endDate) < new Date(startDate))
      return setError("End date cannot be before start date.");

    const loggedUser = sessionStorage.getItem("user");
    const loggedUserId = loggedUser ? JSON.parse(loggedUser).user_id : 1;

    const payload = {
      user_id: Number(userId),
      monthly_amount: Number(monthlyAmount),
      start_date: startDate,
      end_date: endDate || null,
      is_active: isActive,
      updated_by: Number(loggedUserId),
    };

    setSubmitting(true);
    try {
      // REFACTOR: Use id param
      const res = await fetch(
        `${INTERNAL_API}?collection=coop_savings_membership&id=${membership.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onEdited(data?.data || data);
      toast.success("Updated successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to update membership.");
      toast.error("Failed to update membership.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-md p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Edit Employee COOP Savings</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Employee</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.user_fname} {u.user_lname}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Amount to be paid per month
            </label>
            <input
              type="number"
              step="0.01"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="e.g. 1000.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                End Date (optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={isActive}
              onChange={(e) => setIsActive(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded"
            >
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-200 text-gray-700"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-persian-blue-800 text-white"
              disabled={submitting}
            >
              {submitting ? "Updating..." : "Update Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* --------------------------
   AddLoanModal (Dynamic)
-------------------------- */
function AddLoanModal({
  availableUsers = [],
  onClose,
  onCreate,
}: {
  availableUsers: User[];
  onClose: () => void;
  onCreate: (newLoan: EmployeeLoan) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [loanAmount, setLoanAmount] = useState<string>("");
  const [monthsToPay, setMonthsToPay] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return availableUsers;
    const s = searchTerm.toLowerCase();
    return availableUsers.filter((u) => {
      const full = `${u.user_fname} ${u.user_lname}`.toLowerCase();
      return full.includes(s) || String(u.user_id).includes(s);
    });
  }, [searchTerm, availableUsers]);

  // Auto-select if exactly one match and the user typed something
  useEffect(() => {
    if (filteredUsers.length === 1 && searchTerm.trim()) {
      setUserId(String(filteredUsers[0].user_id));
    } else if (filteredUsers.length === 0 || !searchTerm.trim()) {
      setUserId("");
    }
  }, [filteredUsers, searchTerm]);

  const numericLoanAmount = Number(loanAmount || 0);
  const interestRate = 0.03; // default 3% as per DDL
  const interestAmount =
    Math.round(numericLoanAmount * interestRate * 100) / 100;
  const netReceived =
    Math.round((numericLoanAmount - interestAmount) * 100) / 100;
  const monthlyPayment =
    monthsToPay > 0
      ? Math.round((numericLoanAmount / monthsToPay) * 100) / 100
      : 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!userId) return setError("Please select an employee.");
    if (!loanAmount || Number(loanAmount) <= 0)
      return setError("Please enter loan amount.");
    if (!monthsToPay || monthsToPay <= 0)
      return setError("Please enter months to pay.");
    if (!startDate) return setError("Please select a start date.");

    const loggedUser = sessionStorage.getItem("user");
    const createdBy = loggedUser ? JSON.parse(loggedUser).user_id : 1;

    const payload = {
      user_id: Number(userId),
      loan_amount: Number(Number(loanAmount).toFixed(2)),
      interest_rate: 3.0,
      interest_amount: Number(interestAmount.toFixed(2)),
      net_amount_released: Number(netReceived.toFixed(2)),
      months_to_pay: Number(monthsToPay),
      monthly_payment: Number(monthlyPayment.toFixed(2)),
      start_date: startDate,
      end_date: null,
      status: "ACTIVE",
      created_by: Number(createdBy),
    };

    setSubmitting(true);
    try {
      // REFACTOR: Use collection param
      const res = await fetch(`${INTERNAL_API}?collection=employee_loan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const created = data?.data || data;
      onCreate(created);
      toast.success("Loan created successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to create loan.");
      toast.error("Failed to create loan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-md p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Add Loan</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Select Employee (you can search employee by id/name)
            </label>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type name or id to filter"
              className="w-full px-3 py-2 border rounded mb-2"
            />
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">-- Select employee --</option>
              {filteredUsers.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.user_fname} {u.user_lname}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Amount to loan
            </label>
            <input
              type="number"
              step="0.01"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="e.g. 1000.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                How many months to pay
              </label>
              <input
                type="number"
                value={monthsToPay}
                min={1}
                onChange={(e) => setMonthsToPay(Number(e.target.value) || 1)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>

          <div>
            <p>
              Note: employee receives (loan - 3%):{" "}
              <strong>{formatPeso(netReceived)}</strong>
            </p>
            <p>
              Interest (3%): <strong>{formatPeso(interestAmount)}</strong>
            </p>
            <p>
              Cutoff Payment / Monthly Payment:{" "}
              <strong>{formatPeso(monthlyPayment)}</strong>
            </p>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-200 text-gray-700"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-persian-blue-800 text-white"
              disabled={submitting}
            >
              {submitting ? "Adding..." : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* --------------------------
   EditLoanModal
-------------------------- */
function EditLoanModal({
  loan,
  onClose,
  onUpdated,
}: {
  loan: EmployeeLoan;
  onClose: () => void;
  onUpdated: (updated: EmployeeLoan) => void;
}) {
  const [status, setStatus] = useState<EmployeeLoan["status"]>(loan.status);
  const [monthlyPay, setMonthlyPay] = useState<number>(
    Number(loan.monthly_payment || 0)
  );
  const [endDate, setEndDate] = useState<string | "">(loan.end_date || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const payload: Partial<EmployeeLoan> = {
      status,
      monthly_payment: monthlyPay,
      end_date: endDate || null,
      updated_by: (() => {
        const s = sessionStorage.getItem("user");
        return s ? JSON.parse(s).user_id : 1;
      })(),
    };

    setSubmitting(true);
    try {
      // REFACTOR: Use id param
      const res = await fetch(
        `${INTERNAL_API}?collection=employee_loan&id=${loan.loan_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const updated = data?.data || data;
      onUpdated(updated);
      toast.success("Updated successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to update loan.");
      toast.error("Failed to update loan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-md p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Edit Loan — {loan.loan_id}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as EmployeeLoan["status"])
              }
              className="w-full px-3 py-2 border rounded"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAID">PAID</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Cutoff Payment / Monthly Payment
            </label>
            <input
              type="number"
              step="0.01"
              value={monthlyPay}
              onChange={(e) => setMonthlyPay(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              End Date (optional)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-200 text-gray-700"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-persian-blue-800 text-white"
              disabled={submitting}
            >
              {submitting ? "Updating..." : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
