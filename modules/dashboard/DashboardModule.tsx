"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Users, DollarSign, Calendar, FileText } from "lucide-react";
import { StatsCard } from "./components/StatsCard";
import { DashboardCharts } from "./components/DashboardCharts";
import { fetchDashboardData } from "./providers/dashboardService";
import type { DashboardStats, ChartData, DistributionData } from "./types";
import { motion } from "framer-motion";
import { getLoggedUser } from "@/lib/auth";

export default function DashboardModule() {
  const [userName, setUserName] = useState("User");
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState<DashboardStats>({
    employees: 0,
    payrollThisMonth: 0,
    upcomingLeaves: 0,
    pendingApprovals: 0,
  });

  const [payrollTrend, setPayrollTrend] = useState<ChartData[]>([]);
  const [employeeDistribution, setEmployeeDistribution] = useState<DistributionData[]>([]);

  useEffect(() => {
    // 1. User Session
    const timer = setTimeout(() => {
      const user = getLoggedUser();
      if (user && user.user_fname) {
        setUserName(user.user_fname);
      }
    }, 0);

    // 2. Fetch Data
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchDashboardData();
        
        setStats(data.stats);
        setPayrollTrend(data.payrollTrend);
        setEmployeeDistribution(data.employeeDistribution);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    return () => clearTimeout(timer);
  }, []);

  return (
    <DashboardLayout>
       {/* Background Gradient Mesh */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse" />
        <div className="absolute top-[10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-sky-500/20 blur-[100px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] rounded-full bg-primary/15 blur-[100px] mix-blend-multiply dark:mix-blend-screen" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl space-y-8 px-4 pb-10">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Welcome back, {userName}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Here&apos;s what&apos;s happening in your organization today.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Employees"
            value={stats.employees}
            icon={Users}
            description="Active personnel"
            loading={loading}
            delay={1}
          />
          <StatsCard
            title="Payroll (Latest)"
            value={`₱${stats.payrollThisMonth.toLocaleString()}`}
            icon={DollarSign}
            trend="+2.5%" 
            trendUp={true}
            description="Since last cutoff"
            loading={loading}
            delay={2}
          />
          <StatsCard
            title="Pending Approvals"
            value={stats.pendingApprovals}
            icon={FileText}
            description="Requires attention"
            loading={loading}
            delay={3}
            trend={stats.pendingApprovals > 0 ? "Action Needed" : "All Clear"}
            trendUp={stats.pendingApprovals === 0}
          />
           <StatsCard
            title="Upcoming Leaves"
            value={stats.upcomingLeaves}
            icon={Calendar}
            description="Next 7 days"
            loading={loading}
            delay={4}
          />
        </div>

        {/* Charts Section */}
        <DashboardCharts 
          payrollTrend={payrollTrend}
          employeeDistribution={employeeDistribution}
          loading={loading}
        />
      </div>
    </DashboardLayout>
  );
}
