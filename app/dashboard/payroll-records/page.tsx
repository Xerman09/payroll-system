"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowUpDown } from "lucide-react";
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

const SortableTableHead = ({
  label,
  sortKey,
  currentSort,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: string;
  currentSort: {key: string, direction: 'asc' | 'desc'};
  onSort: (key: string) => void;
  className?: string;
}) => (
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

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState("employees");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filterDept, setFilterDept] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{key: "id" | "fname" | "lname" | "department", direction: 'asc' | 'desc'}>({
    key: "id",
    direction: 'asc'
  });

  const handleSort = (key: "id" | "fname" | "lname" | "department") => {
    setSortConfig(prev => prev.key === key && prev.direction === 'asc' ? {key, direction: 'desc'} : {key, direction: 'asc'});
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Fetch Employees via Internal API Route
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        // Updated: Call internal API proxy
        const res = await fetch("/api/payroll?type=employees");

        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();

        // Ensure data.data exists before filtering
        if (data.data) {
          const activeEmployees = data.data.filter(
            (emp: Employee) => !emp.is_deleted?.data?.[0]
          );
          setEmployees(activeEmployees);
        }
      } catch (error) {
        console.error("Error fetching employees:", error);
        toast.error("Failed to load employees.");
      }
    };
    fetchEmployees();
  }, []);

  // Fetch Departments via Internal API Route
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        // Updated: Call internal API proxy
        const res = await fetch("/api/payroll?type=departments");

        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();
        if (data.data) {
          setDepartments(data.data);
        }
      } catch (error) {
        console.error("Error fetching departments:", error);
        toast.error("Failed to load departments.");
      }
    };
    fetchDepartments();
  }, []);

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
      let aVal: any, bVal: any;
      switch (sortConfig.key) {
        case "id":
          aVal = a.user_id;
          bVal = b.user_id;
          break;
        case "fname":
          aVal = a.user_fname;
          bVal = b.user_fname;
          break;
        case "lname":
          aVal = a.user_lname;
          bVal = b.user_lname;
          break;
        case "department":
          aVal = departments.find((d) => d.department_id === a.user_department)?.department_name ?? "";
          bVal = departments.find((d) => d.department_id === b.user_department)?.department_name ?? "";
          break;
      }
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      } else {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
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
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Payroll Records
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === "employees"
                ? "Manage employee records and payroll information."
                : "View and manage tap sheet records."}
            </p>
          </div>
        </div>
        <Separator />

        {/* Main Content Card */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <CardContent className="p-6 space-y-6">
            {/* Filters Row - only for employees tab */}
            {activeTab === "employees" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Department
                  </Label>
                  <select
                    className="border px-2 py-1 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full"
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
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Search employee
                  </Label>
                  <input
                    type="text"
                    placeholder="Type name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border px-2 py-1 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sort by
                  </Label>
                  <Select value={sortConfig.key} onValueChange={(value: any) => setSortConfig({key: value, direction: 'asc'})}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="id">ID</SelectItem>
                      <SelectItem value="fname">First Name</SelectItem>
                      <SelectItem value="lname">Last Name</SelectItem>
                      <SelectItem value="department">Department</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="employees">
                  Employees
                </TabsTrigger>
                <TabsTrigger value="tap-sheet">
                  Tap Sheet
                </TabsTrigger>
              </TabsList>

              {/* EMPLOYEES TABLE */}
              <TabsContent value="employees" className="mt-0 space-y-4">
                <CardHeader className="px-0">
                  <CardTitle>Employee List</CardTitle>
                </CardHeader>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead label="Employee ID" sortKey="id" currentSort={sortConfig} onSort={handleSort} />
                        <SortableTableHead label="Name" sortKey="fname" currentSort={sortConfig} onSort={handleSort} />
                        <SortableTableHead label="Department" sortKey="department" currentSort={sortConfig} onSort={handleSort} />
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
                          <TableRow key={emp.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <TableCell>{emp.user_id}</TableCell>
                            <TableCell>{`${emp.user_fname} ${
                              emp.user_mname ?? ""
                            } ${emp.user_lname}`}</TableCell>
                            <TableCell>{deptName}</TableCell>
                            <TableCell className="flex gap-2">
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">Generate Summary</Button>
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
                      className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
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
                          className={currentPage === page ? "bg-blue-600 hover:bg-blue-700 text-white" : "border-blue-600 text-blue-600 hover:bg-blue-50"}
                        >
                          {page}
                        </Button>
                      )
                    )}

                    <Button
                      size="sm"
                      disabled={currentPage === totalPages || totalPages === 0}
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tap-sheet" className="mt-0 space-y-4">
                <CardHeader className="px-0">
                  <CardTitle>Tap Sheet</CardTitle>
                </CardHeader>
                {/* empty */}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
