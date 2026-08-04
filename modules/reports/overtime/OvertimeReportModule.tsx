"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Search, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OvertimeRequest = {
  overtime_id: number;
  user_id: number;
  employee_name: string;
  department_name: string;
  request_date: string;
  sched_timeout: string;
  ot_from: string;
  ot_to: string;
  duration_minutes: number;
  purpose: string;
  remarks: string;
  status: string;
  filed_at: string;
};

export default function OvertimeReportModule() {
  const [data, setData] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch("/api/reports/overtime");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to fetch data");
        
        setData(json.data || []);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Error loading report");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const departments = useMemo(() => {
    const depts = new Set<string>();
    data.forEach(d => {
      if (d.department_name && d.department_name !== "Unknown Dept") {
        depts.add(d.department_name);
      }
    });
    return Array.from(depts).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchSearch = item.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.purpose && item.purpose.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      const matchDept = departmentFilter === "all" || item.department_name === departmentFilter;
      
      return matchSearch && matchStatus && matchDept;
    });
  }, [data, searchTerm, statusFilter, departmentFilter]);

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Approved</span>;
      case "rejected":
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Rejected</span>;
      case "cancelled":
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">Cancelled</span>;
      default:
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Pending</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Overtime Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and track employee overtime requests across all departments.
          </p>
        </div>
      </div>

      <Separator />

      <Card className="shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <CardContent className="p-6 space-y-6">
          
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search employee or purpose..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full"
              />
            </div>
            
            <div className="flex gap-4 w-full md:w-auto">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Request Date</th>
                  <th className="px-4 py-3 font-medium">Overtime (From/To)</th>
                  <th className="px-4 py-3 font-medium text-center">Duration</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Filed On</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      <div className="flex justify-center items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Loading data...
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No overtime requests found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => (
                    <tr key={row.overtime_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{row.employee_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.department_name}</td>
                      <td className="px-4 py-3 font-medium">{row.request_date}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col text-xs">
                          <span className="text-gray-500">From: {row.ot_from}</span>
                          <span className="font-medium text-blue-600 dark:text-blue-400">To: {row.ot_to}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-green-600 dark:text-green-400">
                        {row.duration_minutes} mins
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(row.status)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(row.filed_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
        </CardContent>
      </Card>
    </div>
  );
}
