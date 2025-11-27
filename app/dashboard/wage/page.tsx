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

export default function WageManagementPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  // Password dialog state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  // Static Wage Form Data
  const [wageData, setWageData] = useState({
    dailyWage: 486,
    vacationLeave: 15,
    sickLeave: 10,
    isPaidHoliday: true,
    lastUpdatedBy: "Erman",
    lastUpdateDate: "11/23/2025",
  });

  // Fetch departments
  useEffect(() => {
    fetch("http://100.126.246.124:8060/items/department")
      .then((res) => res.json())
      .then((data) => setDepartments(data.data))
      .catch(console.error);
  }, []);

  // Fetch employees when department is selected
  useEffect(() => {
    if (selectedDept) {
      fetch("http://100.126.246.124:8060/items/user")
        .then((res) => res.json())
        .then((data) => {
          const activeEmployees = data.data.filter(
            (emp: any) =>
              emp.user_department === selectedDept &&
              (!emp.is_deleted || emp.is_deleted.data[0] === 0)
          );
          setEmployees(activeEmployees);
        })
        .catch(console.error);
    }
  }, [selectedDept]);

  const handleDeptClick = (deptId: number) => {
    setSelectedDept(deptId);
    setModalOpen(false);
  };

  const openPasswordDialog = (employee: any) => {
    setSelectedEmployee(employee);
    setPasswordInput("");
    setPasswordDialogOpen(true);
  };

  const handlePasswordSubmit = async () => {
    try {
      // Get the logged-in user info from sessionStorage
      const session = sessionStorage.getItem("user");
      if (!session) {
        alert("❌ User not logged in!");
        return;
      }

      const loggedUser = JSON.parse(session);
      const userId = loggedUser.user_id;

      // Fetch the user info from API using the logged-in user_id
      const res = await fetch(
        `http://100.126.246.124:8060/items/user/${userId}`
      );
      const data = await res.json();
      const apiUser = data.data || data; // adjust depending on API response

      // Check if the entered password matches the API password
      if (passwordInput === apiUser.user_password) {
        setPasswordDialogOpen(false);
        setModalOpen(true);
        console.log(
          `✅ Wage management opened for ${
            selectedEmployee.user_fname
          } at ${new Date().toISOString()}`
        );
      } else {
        alert("❌ Incorrect password!");
      }
    } catch (error) {
      console.error("Error verifying password:", error);
      alert("❌ Failed to verify password. Please try again.");
    }
  };

  return (
    <DashboardLayout>
      <h2 className="text-2xl font-bold mb-6">Wage Management</h2>

      {/* Department Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4 mb-6">
        {departments.map((dept) => (
          <Card
            key={dept.department_id}
            className={`cursor-pointer hover:shadow-lg transition transform ${
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

      {/* Employees Table */}
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
                <TableHead>Employee ID</TableHead>
                <TableHead>Employee Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.user_id}>
                  <TableCell>{emp.user_id}</TableCell>
                  <TableCell>{`${emp.user_fname} ${emp.user_lname}`}</TableCell>
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

      {/* Password Verification Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-sm p-6 rounded-xl shadow-lg">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-semibold text-center">
              Enter Your Password
            </DialogTitle>
            <p className="text-sm text-gray-500 text-center mt-1">
              For security reasons, please enter your login password to access
              wage management for employees.
            </p>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handlePasswordSubmit();
            }}
            className="flex items-center gap-2 mt-4"
          >
            <Input
              type="password"
              placeholder="Your password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="flex-1 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
            <Button type="submit" className="px-4 py-2 rounded-lg">
              Enter
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Wage Management Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Employee Wage Information{" "}
              {selectedEmployee
                ? `- ${selectedEmployee.user_fname} ${selectedEmployee.user_lname}`
                : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium">Employee ID</label>
              <Input value={selectedEmployee?.user_id || ""} readOnly />
            </div>

            <div>
              <label className="block text-sm font-medium">Employee Name</label>
              <Input
                value={
                  selectedEmployee
                    ? `${selectedEmployee.user_fname} ${selectedEmployee.user_lname}`
                    : ""
                }
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                Daily Wage (per day)
              </label>
              <Input
                type="number"
                value={wageData.dailyWage}
                onChange={(e) =>
                  setWageData({
                    ...wageData,
                    dailyWage: parseInt(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                Vacation Leave Per Year
              </label>
              <Input
                type="number"
                value={wageData.vacationLeave}
                onChange={(e) =>
                  setWageData({
                    ...wageData,
                    vacationLeave: parseInt(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                Sick Leave Per Year
              </label>
              <Input
                type="number"
                value={wageData.sickLeave}
                onChange={(e) =>
                  setWageData({
                    ...wageData,
                    sickLeave: parseInt(e.target.value),
                  })
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox checked={wageData.isPaidHoliday} />
              <span>Paid Holiday</span>
            </div>
          </div>

          <DialogFooter className="mt-4 flex justify-between items-center">
            <span className="text-sm text-gray-500">
              Last update by: {wageData.lastUpdatedBy} |{" "}
              {wageData.lastUpdateDate}
            </span>
            <Button onClick={() => setModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
