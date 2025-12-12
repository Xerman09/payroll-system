"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import DashboardLayout from "@/components/layout/DashboardLayout";

type Employee = {
  user_id: number;
  user_fname: string;
  user_mname: string | null;
  user_lname: string;
  user_department: number | null;
  user_position: string;
  user_dateOfHire: string;
  user_contact: string;
  is_deleted?: { data?: (number | null)[] };
};

type Department = {
  department_id: number;
  department_name: string;
};

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState("employees");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogActiveTab, setDialogActiveTab] = useState("info");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filterDept, setFilterDept] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"id" | "fname" | "lname" | "department">(
    "id"
  );

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch("http://100.126.246.124:8060/items/user");
        const data = await res.json();
        const activeEmployees = data.data.filter(
          (emp: Employee) => !emp.is_deleted?.data?.[0]
        );
        setEmployees(activeEmployees);
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await fetch("http://100.126.246.124:8060/items/department");
        const data = await res.json();
        setDepartments(data.data);
      } catch (error) {
        console.error("Error fetching departments:", error);
      }
    };
    fetchDepartments();
  }, []);

  const openDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDialogActiveTab("info");
    setDialogOpen(true);
  };

  const filteredEmployees = employees
    .filter((emp) => {
      const fullName = `${emp.user_fname} ${emp.user_mname ?? ""} ${
        emp.user_lname
      }`.toLowerCase();
      const matchesDept = filterDept
        ? emp.user_department === filterDept
        : true;
      const matchesSearch =
        emp.user_id.toString().includes(searchTerm.toLowerCase()) ||
        fullName.includes(searchTerm.toLowerCase());
      return matchesDept && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "id":
          return a.user_id - b.user_id;
        case "fname":
          return a.user_fname.localeCompare(b.user_fname);
        case "lname":
          return a.user_lname.localeCompare(b.user_lname);
        case "department":
          const deptA =
            departments.find((d) => d.department_id === a.user_department)
              ?.department_name ?? "";
          const deptB =
            departments.find((d) => d.department_id === b.user_department)
              ?.department_name ?? "";
          return deptA.localeCompare(deptB);
      }
    });

  const totalPages = Math.ceil(filteredEmployees.length / rowsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  };

  const getPageButtons = () => {
    const buttons: (number | string)[] = [];
    let start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);

    if (start > 1) {
      buttons.push(1);
      if (start > 2) buttons.push("...");
    }
    for (let i = start; i <= end; i++) buttons.push(i);
    if (end < totalPages) {
      if (end < totalPages - 1) buttons.push("...");
      buttons.push(totalPages);
    }
    return buttons;
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          Payroll System
        </h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger
              value="employees"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Employees
            </TabsTrigger>
            <TabsTrigger
              value="tap-sheet"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Top Sheet
            </TabsTrigger>
          </TabsList>

          {/* EMPLOYEES TABLE */}
          <TabsContent value="employees">
            <Card className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
              <CardHeader>
                <CardTitle>Employee List</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row justify-between mb-4 gap-2">
                  <select
                    className="border px-2 py-1 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    value={filterDept ?? ""}
                    onChange={(e) =>
                      setFilterDept(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                  >
                    <option value="">All Departments</option>
                    {departments.map((dept) => (
                      <option
                        key={dept.department_id}
                        value={dept.department_id}
                      >
                        {dept.department_name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Search by ID / Name"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border px-2 py-1 rounded flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />

                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => setSortBy("id")}>Sort by ID</Button>
                    <Button onClick={() => setSortBy("fname")}>
                      Sort by First Name
                    </Button>
                    <Button onClick={() => setSortBy("lname")}>
                      Sort by Last Name
                    </Button>
                    <Button onClick={() => setSortBy("department")}>
                      Sort by Department
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEmployees.map((emp) => {
                        const deptName =
                          departments.find(
                            (d) => d.department_id === emp.user_department
                          )?.department_name ?? "N/A";
                        return (
                          <TableRow key={emp.user_id}>
                            <TableCell>{emp.user_id}</TableCell>
                            <TableCell>{`${emp.user_fname} ${
                              emp.user_mname ?? ""
                            } ${emp.user_lname}`}</TableCell>
                            <TableCell>{deptName}</TableCell>
                            <TableCell className="flex gap-2">
                              <Button size="sm" onClick={() => openDialog(emp)}>
                                Edit Cut-off
                              </Button>
                              <Button size="sm">Generate Summary</Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between items-center mt-4 text-gray-900 dark:text-gray-100">
                  <div>
                    Rows per page:{" "}
                    <select
                      className="border px-2 py-1 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tap-sheet">
            <Card className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
              <CardHeader>
                <CardTitle>Tap Sheet</CardTitle>
              </CardHeader>
              <CardContent>{/* empty */}</CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* DIALOG */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-2xl w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <DialogHeader>
              <DialogTitle>
                Employee Cut-off:{" "}
                {selectedEmployee
                  ? `${selectedEmployee.user_fname} ${
                      selectedEmployee.user_mname ?? ""
                    } ${selectedEmployee.user_lname}`
                  : ""}
              </DialogTitle>
            </DialogHeader>

            <Tabs
              value={dialogActiveTab}
              onValueChange={setDialogActiveTab}
              className="w-full mt-4"
            >
              <TabsList className="grid grid-cols-5 mb-4">
                <TabsTrigger value="info">Employee Info</TabsTrigger>
                <TabsTrigger value="additions">Additions</TabsTrigger>
                <TabsTrigger value="deductions">Deductions</TabsTrigger>
                <TabsTrigger value="gross">Gross Pay</TabsTrigger>
                <TabsTrigger value="summary">Cut-off Summary</TabsTrigger>
              </TabsList>

              <AnimatePresence mode="wait">
                <motion.div
                  key={dialogActiveTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  {dialogActiveTab === "info" && selectedEmployee && (
                    <TabsContent value="info">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {[
                          {
                            label: "Employee ID",
                            value: selectedEmployee.user_id,
                          },
                          {
                            label: "Name",
                            value: `${selectedEmployee.user_fname} ${
                              selectedEmployee.user_mname ?? ""
                            } ${selectedEmployee.user_lname}`,
                          },
                          {
                            label: "Department",
                            value:
                              departments.find(
                                (d) =>
                                  d.department_id ===
                                  selectedEmployee.user_department
                              )?.department_name ?? "N/A",
                          },
                          { label: "Total Days/Hours Worked", value: "" },
                        ].map((field, idx) => (
                          <div key={idx} className="flex flex-col">
                            <label className="text-sm font-medium mb-1">
                              {field.label}
                            </label>
                            <input
                              type="text"
                              value={field.value}
                              readOnly
                              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  )}
                  {dialogActiveTab === "additions" && (
                    <TabsContent value="additions">{/* ... */}</TabsContent>
                  )}
                  {dialogActiveTab === "deductions" && (
                    <TabsContent value="deductions">{/* ... */}</TabsContent>
                  )}
                  {dialogActiveTab === "gross" && (
                    <TabsContent value="gross">{/* ... */}</TabsContent>
                  )}
                  {dialogActiveTab === "summary" && (
                    <TabsContent value="summary">{/* ... */}</TabsContent>
                  )}
                </motion.div>
              </AnimatePresence>
            </Tabs>

            <DialogFooter>
              <Button onClick={() => setDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
