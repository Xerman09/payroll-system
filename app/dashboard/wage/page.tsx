"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function WageManagementPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const [wageData, setWageData] = useState({
    id: null as number | null,
    dailyWage: 0,
    dailyWageInput: "",
    vacationLeave: 0,
    sickLeave: 0,
    isPaidHoliday: false,
    sss: "0.00",
    pagibig: "0.00",
    philhealth: "0.00",
    lastUpdatedBy: "",
    lastUpdateDate: "",
  });

  const [sortField, setSortField] = useState<string>("user_id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Fetch departments and employees
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("http://100.126.246.124:8060/items/department?limit=-1").then((r) =>
        r.json()
      ),
      fetch("http://100.126.246.124:8060/items/user?limit=-1").then((r) =>
        r.json()
      ),
    ])
      .then(([deptRes, empRes]) => {
        setDepartments(deptRes.data || []);
        const list = (empRes.data || []).filter(
          (emp: any) => !emp.is_deleted || emp.is_deleted.data?.[0] === 0
        );
        setEmployees(list);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // Filtered + Sorted Employees
  const filteredEmployees = employees
    .filter((emp) => {
      const deptMatch = selectedDept
        ? emp.user_department === selectedDept
        : true;
      const term = searchTerm.toLowerCase();
      const searchMatch =
        emp.user_id.toString().includes(term) ||
        emp.user_fname.toLowerCase().includes(term) ||
        emp.user_lname.toLowerCase().includes(term);
      return deptMatch && searchMatch;
    })
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      if (typeof aValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else if (typeof aValue === "number") {
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }
      return 0;
    });

  // Pagination
  const totalPages = Math.ceil(filteredEmployees.length / rowsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getUserFullName = async (userId: number | null) => {
    if (!userId && userId !== 0) return "Unknown";
    try {
      const res = await fetch(
        `http://100.126.246.124:8060/items/user/${userId}`
      );
      const json = await res.json();
      const u = json.data;
      if (!u) return "Unknown";
      return `${u.user_fname} ${u.user_lname}`;
    } catch (e) {
      console.error("getUserFullName error:", e);
      return "Unknown";
    }
  };

  const openPasswordDialog = (emp: any) => {
    setSelectedEmployee(emp);
    setPasswordInput("");
    setPasswordDialogOpen(true);
  };

  const logWageAccess = async (
    openedById: number,
    userId: number,
    employeeName: string
  ) => {
    try {
      const timestamp = new Date().toISOString();
      const remarks = `Opened wage modal for ${employeeName} at ${timestamp}`;
      await fetch("http://100.126.246.124:8060/items/user_wage_access_log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          opened_by: openedById,
          remarks,
        }),
      });
    } catch (e) {
      console.error("logWageAccess error:", e);
    }
  };

  const handlePasswordSubmit = async () => {
    try {
      const session = sessionStorage.getItem("user");
      if (!session) return alert("User not logged in.");
      const logged = JSON.parse(session);

      const res = await fetch(
        `http://100.126.246.124:8060/items/user/${logged.user_id}`
      );
      const json = await res.json();
      const apiUser = json.data;

      if (!apiUser) return alert("User record not found.");
      if (passwordInput !== apiUser.user_password)
        return alert("Incorrect password.");

      await logWageAccess(
        logged.user_id,
        selectedEmployee.user_id,
        `${selectedEmployee.user_fname} ${selectedEmployee.user_lname}`
      );

      setPasswordDialogOpen(false);
      await loadWageData(selectedEmployee.user_id);
      setModalOpen(true);
    } catch (e) {
      console.error(e);
      alert("Error verifying password. Try again.");
    }
  };

  const loadWageData = async (userId: number) => {
    try {
      const res = await fetch(
        `http://100.126.246.124:8060/items/user_wage_management?filter[user_id][_eq]=${userId}`
      );
      const json = await res.json();
      const record = (json.data && json.data[0]) || null;

      if (!record) {
        setWageData({
          id: null,
          dailyWage: 0,
          dailyWageInput: "",
          vacationLeave: 0,
          sickLeave: 0,
          isPaidHoliday: false,
          sss: "0.00",
          pagibig: "0.00",
          philhealth: "0.00",
          lastUpdatedBy: "",
          lastUpdateDate: "",
        });
        return;
      }

      const responsibleUserId = record.updated_by ?? record.created_by ?? null;
      const fullName = responsibleUserId
        ? await getUserFullName(responsibleUserId)
        : "";
      const lastDate =
        record.updated_date?.substring(0, 10) ||
        record.created_date?.substring(0, 10) ||
        "";

      setWageData({
        id: record.id,
        dailyWage: Number(record.daily_wage) || 0,
        dailyWageInput: (Number(record.daily_wage) || 0).toString(),
        vacationLeave: Number(record.vacation_leave_per_year) || 0,
        sickLeave: Number(record.sick_leave_per_year) || 0,
        isPaidHoliday: record.paid_holiday === 1,
        sss: record.sss_contribution_monthly ?? "0.00",
        pagibig: record.pagibig_contribution_monthly ?? "0.00",
        philhealth: record.philhealth_contribution_monthly ?? "0.00",
        lastUpdatedBy: fullName || "",
        lastUpdateDate: lastDate,
      });
    } catch (e) {
      console.error("loadWageData error:", e);
    }
  };

  const saveWageData = async () => {
    const session = sessionStorage.getItem("user");
    if (!session) return alert("User session missing.");
    const logged = JSON.parse(session);

    if (!selectedEmployee) return alert("No employee selected.");
    if (
      !window.confirm(
        `Save wage settings for ${selectedEmployee.user_fname} ${selectedEmployee.user_lname}?`
      )
    )
      return;

    const payload: any = {
      user_id: selectedEmployee.user_id,
      daily_wage: Number(wageData.dailyWage) || 0,
      vacation_leave_per_year: Number(wageData.vacationLeave) || 0,
      sick_leave_per_year: Number(wageData.sickLeave) || 0,
      paid_holiday: wageData.isPaidHoliday ? 1 : 0,
      updated_by: logged.user_id,

      // Benefits as strings (match API)
      sss_contribution_monthly: wageData.sss,
      pagibig_contribution_monthly: wageData.pagibig,
      philhealth_contribution_monthly: wageData.philhealth,
    };

    const method = wageData.id ? "PATCH" : "POST";
    const url = wageData.id
      ? `http://100.126.246.124:8060/items/user_wage_management/${wageData.id}`
      : `http://100.126.246.124:8060/items/user_wage_management`;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Wage information saved successfully.");
      await loadWageData(selectedEmployee.user_id);
      setModalOpen(false);
    } catch (e) {
      console.error("saveWageData error:", e);
      toast.error("Failed to save wage data.");
    }
  };

  // Skeleton rows
  const skeletonRows = Array.from({ length: rowsPerPage });

  // Pagination helper: max 5 page buttons
  const getPageButtons = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(currentPage - 2, 1);
      let end = start + 4;

      if (end > totalPages) {
        end = totalPages;
        start = end - 4;
      }

      for (let i = start; i <= end; i++) pages.push(i);

      if (start > 1) pages.unshift("...");
      if (end < totalPages) pages.push("...");
    }
    return pages;
  };

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  return (
    <DashboardLayout>
      <h2 className="text-2xl font-bold mb-6">Wage Management</h2>

      <div className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-4 mb-6 shadow-sm bg-white dark:bg-gray-900">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-4 items-center mb-4">
          <div className="w-72">
            <Select
              value={selectedDept !== null ? selectedDept.toString() : "all"}
              onValueChange={(val) =>
                setSelectedDept(val === "all" ? null : Number(val))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Department (Optional)" />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-700 dark:text-white">
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem
                    key={dept.department_id}
                    value={dept.department_id.toString()}
                  >
                    {dept.department_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[220px]">
            <Input
              placeholder="Search Employee ID or Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => handleSort("user_id")}>Sort by ID</Button>
            <Button onClick={() => handleSort("user_fname")}>
              Sort by First Name
            </Button>
            <Button onClick={() => handleSort("user_lname")}>
              Sort by Last Name
            </Button>
          </div>
        </div>

        {/* Employees Table */}
        <div className="overflow-x-auto w-full border border-gray-300 dark:border-gray-700  shadow-sm bg-white dark:bg-gray-900">
          <table className="w-full min-w-[600px] border-collapse border border-gray-300 dark:border-gray-700">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="border p-2 text-left">Employee ID</th>
                <th className="border p-2 text-left">Name</th>
                <th className="border p-2 text-left">Department</th>
                <th className="border p-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? skeletonRows.map((_, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-200 dark:border-gray-600"
                    >
                      <td className="border p-2">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
                      </td>
                      <td className="border p-2">
                        <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
                      </td>
                      <td className="border p-2">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
                      </td>
                      <td className="border p-2">
                        <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
                      </td>
                    </tr>
                  ))
                : paginatedEmployees.map((emp) => {
                    const deptName =
                      departments.find(
                        (d) => d.department_id === emp.user_department
                      )?.department_name ?? "N/A";
                    return (
                      <tr
                        key={emp.user_id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <td className="border p-2">{emp.user_id}</td>
                        <td className="border p-2">
                          {emp.user_fname} {emp.user_lname}
                        </td>
                        <td className="border p-2">{deptName}</td>
                        <td className="border p-2 flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            onClick={() => openPasswordDialog(emp)}
                          >
                            View Wage Info
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <div>
            Rows per page:{" "}
            <select
              className="border px-2 py-1 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
              value={rowsPerPage}
              onChange={handleRowsPerPageChange}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >
              First
            </Button>
            <Button
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
            >
              Prev
            </Button>

            {getPageButtons().map((page, idx) =>
              page === "..." ? (
                <span key={idx} className="px-2 py-1">
                  ...
                </span>
              ) : (
                <Button
                  key={idx}
                  size="sm"
                  variant={currentPage === page ? "default" : "outline"}
                  onClick={() => setCurrentPage(Number(page))}
                >
                  {page}
                </Button>
              )
            )}

            <Button
              size="sm"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((prev) => prev + 1)}
            >
              Next
            </Button>
            <Button
              size="sm"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(totalPages)}
            >
              Last
            </Button>
          </div>
        </div>
      </div>

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-sm p-6 rounded-xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-center">Enter Password</DialogTitle>
            <p className="text-sm text-gray-500 text-center mt-1">
              To access wage management please confirm your login password.
            </p>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handlePasswordSubmit();
            }}
            className="flex gap-2 mt-4"
          >
            <Input
              type="password"
              placeholder="Your password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Button type="submit">Enter</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Wage Info Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-3xl w-full max-h-[80vh] p-6 rounded-md shadow-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
              Wage Information —{" "}
              {selectedEmployee
                ? `${selectedEmployee.user_fname} ${selectedEmployee.user_lname}`
                : ""}
            </DialogTitle>
          </DialogHeader>

          {/* Main Grid */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            {/* Row 1: Employee ID */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Employee ID
              </label>
              <Input
                type="text"
                value={selectedEmployee?.user_id || ""}
                disabled
                className="w-full rounded-md focus:outline-none focus:ring-0"
              />
            </div>

            {/* Row 1: Daily Wage */}
            <div className="flex flex-col relative">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Daily Wage
              </label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                  ₱
                </span>
                <Input
                  type="text"
                  value={wageData.dailyWageInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d*\.?\d*$/.test(value)) {
                      setWageData((prev) => ({
                        ...prev,
                        dailyWageInput: value,
                        dailyWage: Number(value) || 0,
                      }));
                    }
                  }}
                  onBlur={() => {
                    setWageData((prev) => ({
                      ...prev,
                      dailyWageInput: prev.dailyWage.toFixed(2),
                    }));
                  }}
                  className="w-full rounded-md pl-6 focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            {/* Row 2: Vacation Leave */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Vacation Leave
              </label>
              <Input
                type="number"
                value={wageData.vacationLeave}
                onChange={(e) =>
                  setWageData((prev) => ({
                    ...prev,
                    vacationLeave: Number(e.target.value),
                  }))
                }
                className="w-full rounded-md focus:outline-none focus:ring-0"
              />
            </div>

            {/* Row 2: Sick Leave */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Sick Leave
              </label>
              <Input
                type="number"
                value={wageData.sickLeave}
                onChange={(e) =>
                  setWageData((prev) => ({
                    ...prev,
                    sickLeave: Number(e.target.value),
                  }))
                }
                className="w-full rounded-md focus:outline-none focus:ring-0"
              />
            </div>

            {/* Row 3: Paid Holiday */}
            <div className="flex items-center gap-2 col-span-2">
              <Checkbox
                checked={wageData.isPaidHoliday}
                onCheckedChange={(checked) =>
                  setWageData((prev) => ({ ...prev, isPaidHoliday: !!checked }))
                }
              />
              <label className="text-sm text-gray-700 dark:text-gray-200">
                Paid Holiday
              </label>
            </div>

            {/* Divider */}
            <div className="col-span-2 border-t border-gray-300 dark:border-gray-600 mt-2 mb-1"></div>

            {/* Benefits Row */}
            <div className="col-span-2">
              <div className="text-m font-medium text-gray-700 dark:text-gray-200 mb-2">
                Benefits
              </div>
              <div className="grid grid-cols-3 gap-4">
                {["SSS", "Pagibig", "Philhealth"].map((field) => {
                  const key = field.toLowerCase() as
                    | "sss"
                    | "pagibig"
                    | "philhealth";
                  return (
                    <div key={field} className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        {field}
                      </label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                          ₱
                        </span>
                        <Input
                          type="text"
                          value={wageData[key]}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (/^\d*\.?\d*$/.test(value)) {
                              setWageData((prev) => ({
                                ...prev,
                                [key]: value,
                              }));
                            }
                          }}
                          onBlur={() => {
                            setWageData((prev) => ({
                              ...prev,
                              [key]:
                                prev[key] === ""
                                  ? "0.00"
                                  : parseFloat(prev[key]).toFixed(2),
                            }));
                          }}
                          className="w-full rounded-md pl-6 py-2 focus:outline-none focus:ring-0"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Last Updated By: {wageData.lastUpdatedBy} on{" "}
              {wageData.lastUpdateDate}
            </div>
            <div className="flex gap-2">
              <Button
                className="bg-persian-blue-800 hover:bg-persian-blue-700 text-white rounded-md px-6 py-2"
                onClick={saveWageData}
              >
                Save
              </Button>
              <Button
                variant="outline"
                className="rounded-md px-6 py-2"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
