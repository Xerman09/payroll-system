"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
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

  // Password verification modal
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  // Wage data loaded from user_wage_management (or defaults)
  const [wageData, setWageData] = useState({
    id: null as number | null,
    dailyWage: 0 as number,
    vacationLeave: 0 as number,
    sickLeave: 0 as number,
    isPaidHoliday: false,
    lastUpdatedBy: "" as string, // full name
    lastUpdateDate: "" as string, // YYYY-MM-DD
  });

  /* --------------------------
     Helper: fetch single user full name by id
  --------------------------- */
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

  /* --------------------------
     Fetch departments (once)
  --------------------------- */
  useEffect(() => {
    fetch("http://100.126.246.124:8060/items/department")
      .then((r) => r.json())
      .then((d) => setDepartments(d.data || []))
      .catch((err) => console.error("departments fetch error", err));
  }, []);

  /* --------------------------
     Fetch employees when dept selected
  --------------------------- */
  useEffect(() => {
    if (!selectedDept) {
      setEmployees([]);
      return;
    }
    fetch("http://100.126.246.124:8060/items/user")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.data || []).filter(
          (emp: any) =>
            emp.user_department === selectedDept &&
            (!emp.is_deleted || emp.is_deleted.data?.[0] === 0)
        );
        setEmployees(list);
      })
      .catch((err) => console.error("employees fetch error", err));
  }, [selectedDept]);

  const handleDeptClick = (deptId: number) => {
    setSelectedDept(deptId);
    setModalOpen(false);
    setSelectedEmployee(null);
  };

  /* --------------------------
     Open password dialog for selected employee
  --------------------------- */
  const openPasswordDialog = (emp: any) => {
    setSelectedEmployee(emp);
    setPasswordInput("");
    setPasswordDialogOpen(true);
  };

  /* --------------------------
     Verify password
  --------------------------- */
  const handlePasswordSubmit = async () => {
    try {
      const session = sessionStorage.getItem("user");
      if (!session) {
        alert("User not logged in.");
        return;
      }
      const logged = JSON.parse(session);

      const res = await fetch(
        `http://100.126.246.124:8060/items/user/${logged.user_id}`
      );
      const json = await res.json();
      const apiUser = json.data;

      if (!apiUser) {
        alert("User record not found.");
        return;
      }

      if (passwordInput !== apiUser.user_password) {
        alert("Incorrect password.");
        return;
      }

      setPasswordDialogOpen(false);
      await loadWageData(selectedEmployee.user_id);
      setModalOpen(true);
    } catch (e) {
      console.error(e);
      alert("Error verifying password. Try again.");
    }
  };

  /* --------------------------
     Load wage data
  --------------------------- */
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
          vacationLeave: 0,
          sickLeave: 0,
          isPaidHoliday: false,
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
        vacationLeave: Number(record.vacation_leave_per_year) || 0,
        sickLeave: Number(record.sick_leave_per_year) || 0,
        isPaidHoliday: record.paid_holiday === 1,
        lastUpdatedBy: fullName || "",
        lastUpdateDate: lastDate,
      });
    } catch (e) {
      console.error("loadWageData error:", e);
      setWageData((prev) => ({
        ...prev,
        lastUpdatedBy: "",
        lastUpdateDate: "",
      }));
    }
  };

  /* --------------------------
     Save wage data with history
  --------------------------- */
  const saveWageData = async () => {
    const session = sessionStorage.getItem("user");
    if (!session) {
      alert("User session missing.");
      return;
    }
    const logged = JSON.parse(session);

    if (!selectedEmployee) {
      alert("No employee selected.");
      return;
    }

    const confirmed = window.confirm(
      `Save wage settings for ${selectedEmployee.user_fname} ${selectedEmployee.user_lname}?`
    );
    if (!confirmed) return;

    const payload: any = {
      user_id: selectedEmployee.user_id,
      daily_wage: Number(wageData.dailyWage) || 0,
      vacation_leave_per_year: Number(wageData.vacationLeave) || 0,
      sick_leave_per_year: Number(wageData.sickLeave) || 0,
      paid_holiday: wageData.isPaidHoliday ? 1 : 0,
      updated_by: logged.user_id,
    };

    const method = wageData.id ? "PATCH" : "POST";
    const url = wageData.id
      ? `http://100.126.246.124:8060/items/user_wage_management/${wageData.id}`
      : `http://100.126.246.124:8060/items/user_wage_management`;

    try {
      // 1. Update main wage record
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // 2. Update previous history record's valid_to
      if (wageData.id) {
        const latestHistoryRes = await fetch(
          `http://100.126.246.124:8060/items/user_wage_history?filter[user_wage_id][_eq]=${wageData.id}&sort=-valid_from`
        );
        const latestHistoryJson = await latestHistoryRes.json();
        const prevHistory = latestHistoryJson.data?.[0];

        if (prevHistory && !prevHistory.valid_to) {
          const validToISO = new Date().toISOString();
          await fetch(
            `http://100.126.246.124:8060/items/user_wage_history/${prevHistory.history_id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ valid_to: validToISO }),
            }
          );
        }
      }

      // 3. Insert new history record
      const historyPayload = {
        user_wage_id: wageData.id,
        user_id: selectedEmployee.user_id,
        daily_wage: Number(wageData.dailyWage) || 0,
        vacation_leave_per_year: Number(wageData.vacationLeave) || 0,
        sick_leave_per_year: Number(wageData.sickLeave) || 0,
        paid_holiday: wageData.isPaidHoliday ? 1 : 0,
        valid_from: new Date().toISOString(),
        change_type: wageData.id ? "UPDATE" : "INSERT",
        changed_by: logged.user_id,
      };
      await fetch("http://100.126.246.124:8060/items/user_wage_history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(historyPayload),
      });

      toast.success("Wage information saved successfully.");
      await loadWageData(selectedEmployee.user_id);
      setModalOpen(false);
    } catch (e) {
      console.error("saveWageData error:", e);
      toast.error("Failed to save wage data.");
    }
  };

  /* --------------------------
     UI
  --------------------------- */
  return (
    <DashboardLayout>
      <h2 className="text-2xl font-bold mb-6">Wage Management</h2>

      {/* Departments */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {departments.map((dept) => (
          <Card
            key={dept.department_id}
            className={`cursor-pointer hover:shadow-lg transition ${
              selectedDept === dept.department_id
                ? "border-2 border-indigo-500"
                : ""
            }`}
            onClick={() => handleDeptClick(dept.department_id)}
          >
            <CardContent>
              <CardTitle>{dept.department_name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {dept.department_description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Employees */}
      {selectedDept && (
        <>
          <h3 className="text-xl font-semibold mb-4">
            Employees in{" "}
            {departments.find((d) => d.department_id === selectedDept)
              ?.department_name || ""}
          </h3>

          <Table className="bg-white dark:bg-gray-800 rounded-xl shadow mb-6">
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.user_id}>
                  <TableCell>{emp.user_id}</TableCell>
                  <TableCell>
                    {emp.user_fname} {emp.user_lname}
                  </TableCell>
                  <TableCell>
                    {
                      departments.find(
                        (d) => d.department_id === emp.user_department
                      )?.department_name
                    }
                  </TableCell>
                  <TableCell>
                    <Button onClick={() => openPasswordDialog(emp)}>
                      View Wage Info
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {/* Password dialog */}
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

      {/* Wage modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Wage Information —{" "}
              {selectedEmployee
                ? `${selectedEmployee.user_fname} ${selectedEmployee.user_lname}`
                : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 mt-2">
            <div>
              <label className="text-sm font-medium">Employee ID</label>
              <Input
                type="text"
                value={selectedEmployee?.user_id ?? ""}
                disabled
              />
            </div>

            <div>
              <label className="text-sm font-medium">Daily Wage</label>
              <Input
                type="number"
                value={wageData.dailyWage}
                onChange={(e) =>
                  setWageData({
                    ...wageData,
                    dailyWage: Number(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Vacation Leave / Year
              </label>
              <Input
                type="number"
                value={wageData.vacationLeave}
                onChange={(e) =>
                  setWageData({
                    ...wageData,
                    vacationLeave: Number(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium">Sick Leave / Year</label>
              <Input
                type="number"
                value={wageData.sickLeave}
                onChange={(e) =>
                  setWageData({
                    ...wageData,
                    sickLeave: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={wageData.isPaidHoliday}
                onCheckedChange={(v) =>
                  setWageData({ ...wageData, isPaidHoliday: !!v })
                }
              />
              <span>Paid Holiday</span>
            </div>

            {/* Last updated info */}
            {wageData.lastUpdatedBy && (
              <p className="text-sm text-gray-500 mt-2">
                <strong>Last updated by:</strong> {wageData.lastUpdatedBy} |{" "}
                {wageData.lastUpdateDate}
              </p>
            )}
          </div>

          <DialogFooter className="mt-4 flex justify-between items-center">
            <span className="text-sm text-gray-500">
              Record ID: {wageData.id ?? "—"}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Close
              </Button>
              <Button onClick={saveWageData}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
