"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Edit, Trash2 } from "lucide-react";

const API_BASE = "http://100.126.246.124:8060";

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

interface MembershipRow {
  id: number;
  name: string;
  monthly: number;
  months: number;
  totalCollection: number;
  start: string | null;
  end: string | null;
  raw: Membership;
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

/* --------------------------
   Main Coop Page
-------------------------- */
export default function CoopPage() {
  const [activeTab, setActiveTab] = useState("savings");

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          COOP
        </h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger
              value="savings"
              className="data-[state=active]:bg-persian-blue-800 data-[state=active]:text-white"
            >
              Savings
            </TabsTrigger>
            <TabsTrigger
              value="loans"
              className="data-[state=active]:bg-persian-blue-800 data-[state=active]:text-white"
            >
              Loans
            </TabsTrigger>
          </TabsList>

          <TabsContent value="savings">
            <SavingsTab />
          </TabsContent>

          <TabsContent value="loans">
            <LoansTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/* --------------------------
   Loans Tab
-------------------------- */
function LoansTab() {
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [paymentsMap, setPaymentsMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [editingLoan, setEditingLoan] = useState<EmployeeLoan | null>(null);

  const LOANS_ENDPOINT = `${API_BASE}/items/employee_loan`;
  const USERS_ENDPOINT = `${API_BASE}/items/user`;
  const PAYMENTS_ENDPOINT = `${API_BASE}/items/employee_loan_payment`;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      fetch(LOANS_ENDPOINT).then((r) => r.json()),
      fetch(USERS_ENDPOINT).then((r) => r.json()),
      fetch(PAYMENTS_ENDPOINT)
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .catch(() => ({ data: [] })),
    ])
      .then(([lres, ures, pres]) => {
        if (!mounted) return;
        const loanList: EmployeeLoan[] = Array.isArray(lres?.data)
          ? lres.data
          : [];
        const userList: User[] = Array.isArray(ures?.data) ? ures.data : [];
        const paymentsList: LoanPayment[] = Array.isArray(pres?.data)
          ? pres.data
          : [];

        setLoans(loanList);
        setUsers(userList);

        const map: Record<number, number> = {};
        for (const p of paymentsList) {
          const lid = Number(p.loan_id);
          const amt = Number(p.amount || 0);
          if (!lid) continue;
          map[lid] = (map[lid] || 0) + amt;
        }
        setPaymentsMap(map);
      })
      .catch((err) => {
        console.error(err);
        if (!mounted) return;
        setError("Failed to load loans/users/payments.");
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [LOANS_ENDPOINT, PAYMENTS_ENDPOINT, USERS_ENDPOINT]);

  const getUserName = (userId: number) => {
    const user = users.find((u) => Number(u.user_id) === Number(userId));
    return user ? `${user.user_fname} ${user.user_lname}` : `User #${userId}`;
  };

  const handleDeleteLoan = async (loanId: number) => {
    if (!confirm("Are you sure you want to delete this loan?")) return;
    try {
      const res = await fetch(`${LOANS_ENDPOINT}/${loanId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      setLoans(loans.filter((l) => l.loan_id !== loanId));
    } catch (err) {
      console.error(err);
      setError("Failed to delete loan.");
    }
  };

  const rows = useMemo(() => {
    return loans.map((ln) => {
      const loanAmount = Number(ln.loan_amount || 0);
      const totalPaid = paymentsMap[Number(ln.loan_id)] ?? 0;
      const balance = Math.max(0, loanAmount - totalPaid);
      return {
        loan: ln,
        loanAmount,
        totalPaid,
        balance,
      };
    });
  }, [loans, paymentsMap]);

  const usersWithoutActiveLoan = useMemo(() => {
    const activeLoanUserIds = new Set(
      loans.filter((l) => l.status === "ACTIVE").map((l) => Number(l.user_id))
    );
    return users.filter((u) => {
      const isDeleted =
        (u.is_deleted &&
          typeof u.is_deleted === "object" &&
          u.is_deleted.data?.[0] === 1) ||
        u.isDeleted === true ||
        u.deleted === true ||
        u.is_deleted === true;
      return !isDeleted && !activeLoanUserIds.has(Number(u.user_id));
    });
  }, [users, loans]);

  return (
    <Card className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <CardHeader>
        <CardTitle>Employee Loan Report</CardTitle>
        <div className="flex justify-end">
          <Button onClick={() => setOpenAdd(true)}>+ Add Loan</Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading && <div className="text-sm text-gray-600">Loading...</div>}
        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Total Loan</TableHead>
                <TableHead className="text-right">Total Paid</TableHead>
                <TableHead className="text-right">Total Balance</TableHead>
                <TableHead className="text-right">Cutoff Payment</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.length ? (
                rows.map((row, idx) => (
                  <TableRow key={row.loan.loan_id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{getUserName(row.loan.user_id)}</TableCell>
                    <TableCell className="text-right">
                      {formatPeso(row.loanAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPeso(row.totalPaid)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPeso(row.balance)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPeso(row.loan.monthly_payment)}
                    </TableCell>
                    <TableCell className="flex justify-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => setEditingLoan(row.loan)}
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        size="sm"
                        className="bg-destructive"
                        onClick={() => handleDeleteLoan(row.loan.loan_id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-6 text-gray-500"
                  >
                    No records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {openAdd && (
          <AddLoanModal
            availableUsers={usersWithoutActiveLoan}
            onClose={() => setOpenAdd(false)}
            onCreate={(loan) => {
              setLoans([loan, ...loans]);
              setOpenAdd(false);
            }}
            loansEndpoint={LOANS_ENDPOINT}
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
            loansEndpoint={LOANS_ENDPOINT}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------
   AddLoanModal & EditLoanModal
   (keep your existing implementations, no changes needed)
-------------------------- */

function SavingsTab() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMembership, setEditingMembership] = useState<Membership | null>(
    null
  );

  useEffect(() => {
    let mounted = true;

    Promise.all([
      fetch(`${API_BASE}/items/coop_savings_membership`).then((r) => r.json()),
      fetch(`${API_BASE}/items/user`).then((r) => r.json()),
    ])
      .then(([mres, ures]) => {
        if (!mounted) return;
        const membershipList = Array.isArray(mres?.data)
          ? mres.data
          : mres ?? [];
        const userList = Array.isArray(ures?.data) ? ures.data : ures ?? [];
        setMemberships(membershipList);
        setUsers(userList);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load savings or users.");
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  const rows = useMemo(() => {
    return memberships.map((m) => {
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
  }, [memberships, users]);

  const availableUsers = useMemo(() => {
    const memberIds = new Set(memberships.map((m) => Number(m.user_id)));
    return users.filter((u) => {
      const isDeleted =
        (u.is_deleted &&
          typeof u.is_deleted === "object" &&
          u.is_deleted.data?.[0] === 1) ||
        u.isDeleted === true ||
        u.deleted === true ||
        u.is_deleted === true;
      return !isDeleted && !memberIds.has(Number(u.user_id));
    });
  }, [users, memberships]);

  const handleAdded = (newMembership: Membership) => {
    setMemberships((prev) => [newMembership, ...prev]);
    setShowAddModal(false);
  };

  const handleEdit = (row: MembershipRow) => {
    setEditingMembership(row.raw);
    setShowEditModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this membership?")) return;
    try {
      const res = await fetch(
        `${API_BASE}/items/coop_savings_membership/${id}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) throw new Error(await res.text());
      setMemberships((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error(err);
      setError("Failed to delete membership.");
    }
  };

  const handleEdited = (updatedMembership: Membership) => {
    setMemberships((prev) =>
      prev.map((m) => (m.id === updatedMembership.id ? updatedMembership : m))
    );
    setShowEditModal(false);
    setEditingMembership(null);
  };

  return (
    <Card className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <CardHeader>
        <CardTitle>Savings Report</CardTitle>
        <div className="flex justify-end">
          <Button onClick={() => setShowAddModal(true)}>+ Add Employee</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-sm text-gray-600">Loading...</div>}
        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Collection Per month</TableHead>
                <TableHead>Total Collection</TableHead>
                <TableHead>Total Months</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Action</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    No savings members found.
                  </TableCell>
                </TableRow>
              )}

              {rows.map((r, idx) => (
                <TableRow key={r.id ?? idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{formatPeso(r.monthly)}</TableCell>
                  <TableCell>{formatPeso(r.totalCollection)}</TableCell>
                  <TableCell>{r.months}</TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        r.raw.is_active === 1
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 0text-red-80"
                      }`}
                    >
                      {r.raw.is_active === 1 ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="flex justify-center gap-2">
                    <Button size="sm" onClick={() => handleEdit(r)}>
                      <Edit size={14} />
                    </Button>
                    <Button
                      size="sm"
                      className="bg-destructive"
                      onClick={() => handleDelete(r.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                  <TableCell>{r.start ?? "-"}</TableCell>
                  <TableCell>{r.end ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {showAddModal && (
          <AddEmployeeModal
            apiBase={API_BASE}
            availableUsers={availableUsers}
            onClose={() => setShowAddModal(false)}
            onAdded={handleAdded}
          />
        )}

        {showEditModal && editingMembership && (
          <EditEmployeeModal
            apiBase={API_BASE}
            membership={editingMembership}
            users={users}
            onClose={() => {
              setShowEditModal(false);
              setEditingMembership(null);
            }}
            onEdited={handleEdited}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------
   AddEmployeeModal (Savings)
   (unchanged)
-------------------------- */
function AddEmployeeModal({
  apiBase,
  availableUsers = [],
  onClose,
  onAdded,
}: {
  apiBase: string;
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
      const res = await fetch(`${apiBase}/items/coop_savings_membership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onAdded(data?.data || data);
    } catch (err) {
      console.error(err);
      setError("Failed to add member.");
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
   (unchanged)
-------------------------- */
function EditEmployeeModal({
  apiBase,
  membership,
  users,
  onClose,
  onEdited,
}: {
  apiBase: string;
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
      const res = await fetch(
        `${apiBase}/items/coop_savings_membership/${membership.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onEdited(data?.data || data);
    } catch (err) {
      console.error(err);
      setError("Failed to update membership.");
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
   - Select Employee (search)
   - Show net received (loan_amount - 3%)
   - Compute monthly_payment = loan_amount / months_to_pay
-------------------------- */
function AddLoanModal({
  availableUsers = [],
  onClose,
  onCreate,
  loansEndpoint,
}: {
  availableUsers: User[];
  onClose: () => void;
  onCreate: (newLoan: EmployeeLoan) => void;
  loansEndpoint: string;
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
      const res = await fetch(loansEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const created = data?.data || data;
      onCreate(created);
    } catch (err) {
      console.error(err);
      setError("Failed to create loan.");
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
   - Basic: allow updating status or end_date
-------------------------- */
function EditLoanModal({
  loan,
  onClose,
  onUpdated,
  loansEndpoint,
}: {
  loan: EmployeeLoan;
  onClose: () => void;
  onUpdated: (updated: EmployeeLoan) => void;
  loansEndpoint: string;
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
      const res = await fetch(`${loansEndpoint}/${loan.loan_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const updated = data?.data || data;
      onUpdated(updated);
    } catch (err) {
      console.error(err);
      setError("Failed to update loan.");
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
