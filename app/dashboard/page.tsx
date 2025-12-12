"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Users, DollarSign, Calendar, FileText } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";

export default function DashboardPage() {
  const [userName] = useState(() => {
    const session = sessionStorage.getItem("user");
    if (session) {
      const user = JSON.parse(session);
      return user.user_fname || "Admin";
    }
    return "Admin";
  });

  // Sample static data
  const payrollTrend = [
    { month: "Jan", payroll: 30000 },
    { month: "Feb", payroll: 32000 },
    { month: "Mar", payroll: 31000 },
    { month: "Apr", payroll: 34000 },
    { month: "May", payroll: 34500 },
    { month: "Jun", payroll: 33000 },
  ];

  const employeeDistribution = [
    { department: "HR", value: 20 },
    { department: "Engineering", value: 50 },
    { department: "Sales", value: 30 },
    { department: "Finance", value: 28 },
  ];

  const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7f50"];

  const monthlyPayrollOvertime = [
    { month: "Jan", payroll: 30000, overtime: 120 },
    { month: "Feb", payroll: 32000, overtime: 95 },
    { month: "Mar", payroll: 31000, overtime: 80 },
    { month: "Apr", payroll: 34000, overtime: 130 },
    { month: "May", payroll: 34500, overtime: 110 },
    { month: "Jun", payroll: 33000, overtime: 90 },
  ];

  return (
    <DashboardLayout>
      {/* Welcome Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Welcome, {userName}!</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Here&apos;s a summary of your HR &amp; Payroll system.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex items-center gap-3">
          <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-full">
            <Users className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Employees
            </p>
            <p className="text-xl font-semibold">128</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex items-center gap-3">
          <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-full">
            <DollarSign className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Payroll This Month
            </p>
            <p className="text-xl font-semibold">$34,500</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex items-center gap-3">
          <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-full">
            <Calendar className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Upcoming Leaves
            </p>
            <p className="text-xl font-semibold">8</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex items-center gap-3">
          <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-full">
            <FileText className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Pending Approvals
            </p>
            <p className="text-xl font-semibold">12</p>
          </div>
        </div>
      </div>

      {/* Graphs / Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payroll Trend LineChart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
          <h3 className="text-gray-700 dark:text-gray-200 font-semibold mb-4">
            Payroll Trend
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={payrollTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="payroll"
                stroke="#6366f1"
                strokeWidth={3}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Employee Distribution PieChart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
          <h3 className="text-gray-700 dark:text-gray-200 font-semibold mb-4">
            Employee Distribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={employeeDistribution}
                dataKey="value"
                nameKey="department"
                cx="50%"
                cy="50%"
                outerRadius={70}
                fill="#8884d8"
                label
              >
                {employeeDistribution.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stacked Bar Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 mt-6">
        <h3 className="text-gray-700 dark:text-gray-200 font-semibold mb-4">
          Monthly Payroll vs Overtime
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={monthlyPayrollOvertime}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Legend verticalAlign="top" />
            <Bar dataKey="payroll" stackId="a" fill="#6366f1" />
            <Bar dataKey="overtime" stackId="a" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Additional Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
          <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Late Comings
          </h4>
          <p className="text-gray-500 dark:text-gray-400">5 this week</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
          <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Overtime Hours
          </h4>
          <p className="text-gray-500 dark:text-gray-400">
            42 hours this month
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
          <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Pending Documents
          </h4>
          <p className="text-gray-500 dark:text-gray-400">3 documents</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
