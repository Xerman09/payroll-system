"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { cn } from "@/lib/utils";
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

interface Loan {
  id: number;
  name: string;
  totalLoan: number;
  totalPaid: number;
  balance: number;
  cutoffPayment: number;
}

/* --------------------------
   Helper functions
-------------------------- */
function monthsBetweenInclusive(
  startDateStr: string | null,
  endDateStr: string | null
): number {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

  const diffTime = end.getTime() - start.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const months = diffDays / 30.44; // Average days per month
  return Math.max(0, months);
}

function formatMonths(months: number): string {
  const totalDays = Math.round(months * 30.44);
  const fullMonths = Math.floor(totalDays / 30.44);
  const remainingDays = Math.round(totalDays % 30.44);
  if (fullMonths === 0 && remainingDays === 0) return "0 months, 0 days";
  return `${fullMonths} month${
    fullMonths !== 1 ? "s" : ""
  } and ${remainingDays} day${remainingDays !== 1 ? "s" : ""}`;
}

function formatPeso(n: number | string): string {
  const num = Number(n || 0);
  return `₱${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
              className="data-[state=active]:bg-black data-[state=active]:text-white"
            >
              Savings
            </TabsTrigger>
            <TabsTrigger
              value="loans"
              className="data-[state=active]:bg-black data-[state=active]:text-white"
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
   Savings Tab (Dynamic)
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

        <div className="overflow-auto border rounded">
          <table className="w-full border-collapse table-fixed text-gray-900 dark:text-gray-100">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white">
                <th className="border p-2 w-1/4">No.</th>
                <th className="border p-2 w-1/4">Name</th>
                <th className="border p-2 w-1/4">Collection Per month</th>
                <th className="border p-2 w-1/4">Total Collection</th>
                <th className="border p-2 w-1/4">Total Months</th>
                <th className="border p-2 w-1/4">Status</th>
                <th className="border p-2 w-1/4">Action</th>
                <th className="border p-2 w-1/4">Start Date</th>
                <th className="border p-2 w-1/4">End Date</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="p-4 text-sm text-gray-500">
                    No savings members found.
                  </td>
                </tr>
              )}

              {rows.map((r, idx) => (
                <tr
                  key={r.id ?? idx}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="border p-2">{idx + 1}</td>
                  <td className="border p-2">{r.name}</td>
                  <td className="border p-2">{formatPeso(r.monthly)}</td>
                  <td className="border p-2">
                    {formatPeso(r.totalCollection)}
                  </td>
                  <td className="border p-2">{formatMonths(r.months)}</td>
                  <td className="border p-2 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        r.raw.is_active === 1
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {r.raw.is_active === 1 ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="border p-2">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleEdit(r)}
                        className="p-2 text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-2 text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                  <td className="border p-2">{r.start ?? "-"}</td>
                  <td className="border p-2">{r.end ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
              className="px-4 py-2 rounded bg-blue-600 text-white"
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
              className="px-4 py-2 rounded bg-blue-600 text-white"
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
   Loans Tab (Static for now)
-------------------------- */
function LoansTab() {
  const [loans, setLoans] = useState([
    {
      id: 1,
      name: "Erman Ace M. Cerujano",
      totalLoan: 10000,
      totalPaid: 5000,
      balance: 5000,
      cutoffPayment: 1000,
    },
  ]);
  const [openAdd, setOpenAdd] = useState(false);

  return (
    <Card className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <CardHeader>
        <CardTitle>Employee Loan Report</CardTitle>
        <div className="flex justify-end">
          <Button onClick={() => setOpenAdd(true)}>+ Add Loan</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto border rounded">
          <table className="w-full border-collapse table-fixed text-gray-900 dark:text-gray-100">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white">
                <th className="border p-2 w-1/6">No.</th>
                <th className="border p-2 w-1/6">Name</th>
                <th className="border p-2 w-1/6">Total Loan</th>
                <th className="border p-2 w-1/6">Total Paid</th>
                <th className="border p-2 w-1/6">Total Balance</th>
                <th className="border p-2 w-1/6">Cutoff Payment</th>
              </tr>
            </thead>

            <tbody>
              {loans.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-sm text-gray-500">
                    No loan records.
                  </td>
                </tr>
              )}

              {loans.map((l, i) => (
                <tr
                  key={l.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="border p-2">{i + 1}</td>
                  <td className="border p-2">{l.name}</td>
                  <td className="border p-2">{formatPeso(l.totalLoan)}</td>
                  <td className="border p-2">{formatPeso(l.totalPaid)}</td>
                  <td className="border p-2">{formatPeso(l.balance)}</td>
                  <td className="border p-2">{formatPeso(l.cutoffPayment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {openAdd && (
          <AddLoanModal
            onClose={() => setOpenAdd(false)}
            onCreate={(newLoan) => {
              setLoans((prev) => [newLoan, ...prev]);
              setOpenAdd(false);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------
   AddLoanModal (Static)
-------------------------- */
function AddLoanModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (newLoan: Loan) => void;
}) {
  const [employeeName, setEmployeeName] = useState("");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  const netReceived = useMemo(
    () => Math.max(0, Number(amount || 0) * 0.97),
    [amount]
  );
  const totalCutoffs = Math.max(1, Number(months || 1) * 2);
  const cutoffPayment = totalCutoffs
    ? Math.round((netReceived / totalCutoffs) * 100) / 100
    : 0;

  const handleConfirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!employeeName) return setError("Please enter employee name.");
    if (!amount || Number(amount) <= 0)
      return setError("Please enter loan amount.");
    if (!months || Number(months) <= 0)
      return setError("Please enter valid months.");

    const newLoan = {
      id: Date.now(),
      name: employeeName,
      totalLoan: Number(amount),
      totalPaid: 0,
      balance: Number(amount),
      cutoffPayment,
    };
    onCreate(newLoan);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-md p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Add Loan (static)</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleConfirm}>
          <div>
            <label className="block text-sm font-medium mb-1">
              Employee Name
            </label>
            <input
              type="text"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Loan Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              No. of Months
            </label>
            <input
              type="number"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value) || 1)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <p>Net Received: {formatPeso(netReceived)}</p>
            <p>Cutoff Payment: {formatPeso(cutoffPayment)}</p>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-200 text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-600 text-white"
            >
              Add Loan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
