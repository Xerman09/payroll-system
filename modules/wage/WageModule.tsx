// @modules/wage/WageModule.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, TrendingUp } from "lucide-react";

import type { Department, Employee, WagePayload, WageDataState, SalarySchedule } from "./types";
import * as wageApi from "./providers/wageApi"; // ✅ correct path

import EmployeeTable from "./components/EmployeeTable";
import PasswordDialog from "./components/PasswordDialog";
import ConfirmDialog from "./components/ConfirmDialog";
import WageModal from "./components/WageModal";
import { SalaryGradeManagement } from "./components/SalaryGradeManagement";
import { getLoggedUser } from "@/lib/auth";

export function WageModule() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams?.get("tab");
    if (tabParam && (tabParam === "wage" || tabParam === "salary-grade")) {
      return tabParam;
    }
    return "wage";
  });
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState<number>(0);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Sort & Pagination
  const [sortField, setSortField] = useState<keyof Employee>("user_id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(5);

  // Salary schedules list (for the grade picker in WageTab)
  const [salarySchedules, setSalarySchedules] = useState<SalarySchedule[]>([]);

  // Optional cache
  const [previousDailyWage, setPreviousDailyWage] = useState<number | null>(
    null
  );

  const emptyWageData: WageDataState = {
    id: null,
    schedule_id: null,
    dailyWage: 0,
    dailyWageInput: "0.00",
    vacationLeave: 0,
    sickLeave: 0,
    isPaidHoliday: false,
    isCard: false,
    sss: "0.00",
    pagibig: "0.00",
    philhealth: "0.00",
    lastUpdatedBy: "",
    lastUpdateDate: "",
  };

  const [wageData, setWageData] = useState<WageDataState>(emptyWageData);

  const handleTabChange = (val: string) => {
    if (val === activeTab) return;
    setActiveTab(val);
    setIsTabLoading(true);
    setTimeout(() => setIsTabLoading(false), 300);
  };

  // Synchronize activeTab with URL 'tab' parameter
  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    if (tabParam && (tabParam === "wage" || tabParam === "salary-grade")) {
      if (tabParam !== activeTab) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveTab(tabParam);
      }
    }
  }, [searchParams, activeTab]);

  useEffect(() => {
    wageApi.fetchDepartments().then(setDepartments).catch(console.error);
  }, []);

  useEffect(() => {
    const handleLoad = setTimeout(() => setLoading(true), 0);
    wageApi
      .fetchEmployeesPaged({
        page: currentPage,
        pageSize: rowsPerPage,
        search: searchTerm,
        deptId: selectedDept,
        sortField,
        sortOrder,
      })
      .then(({ rows, total }) => {
        setEmployees(rows);
        setTotalEmployees(total);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load employees.");
      })
      .finally(() => setLoading(false));

    return () => clearTimeout(handleLoad);
  }, [
    currentPage,
    rowsPerPage,
    searchTerm,
    selectedDept,
    sortField,
    sortOrder,
    refreshKey,
  ]);

  const handleRefresh = () => setRefreshKey((prev) => prev + 1);

  const handleReset = () => {
    setSearchTerm("");
    setSelectedDept(null);
    setSortField("user_id");
    setSortOrder("asc");
    setCurrentPage(1);
    handleRefresh();
  };

  const handleSort = (field: keyof Employee) => {
    if (sortField === field) {
      setSortOrder((s) => (s === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const openPasswordDialog = (emp: Employee) => {
    setSelectedEmployee(emp);
    setPasswordDialogOpen(true);
  };

  const handlePasswordSubmit = async (passwordInput: string) => {
    try {
      const logged = getLoggedUser();
      if (!logged) {
        toast.error("User not logged in.");
        return;
      }

      // Secure backend verification
      await wageApi.verifyPassword(Number(logged.user_id), passwordInput);

      if (!selectedEmployee) {
        toast.error("No employee selected.");
        return;
      }

      const ts = new Date().toISOString();
      const remarks = `Opened wage modal for ${selectedEmployee.user_fname} ${selectedEmployee.user_lname} at ${ts}`;
      await wageApi.logWageAccess(
        Number(logged.user_id),
        selectedEmployee.user_id,
        remarks
      );

      // Load wage data + salary schedules in parallel
      await Promise.all([
        loadWageData(selectedEmployee.user_id),
        loadSalarySchedules(),
      ]);
      setPasswordDialogOpen(false);
      setModalOpen(true);
    } catch (e) {
      console.error(e);
      toast.error("Error verifying password. Try again.");
    }
  };

  const getUserFullName = async (userId: number | null) => {
    if (!userId && userId !== 0) return "Unknown";
    try {
      const u = await wageApi.fetchUserById(Number(userId));
      return u ? `${u.user_fname} ${u.user_lname}` : "Unknown";
    } catch {
      return "Unknown";
    }
  };

  const loadWageData = async (userId: number) => {
    try {
      const record = await wageApi.fetchWageByUser(userId);

      if (!record) {
        setWageData({ ...emptyWageData });
        setPreviousDailyWage(null);
        return;
      }

      const responsibleUserId = record.updated_by ?? record.created_by ?? null;
      const fullName = responsibleUserId
        ? await getUserFullName(responsibleUserId)
        : "";
      const lastDate = (
        record.updated_date ||
        record.created_date ||
        ""
      ).substring(0, 10);

      const dailyWageNum = Number(record.daily_wage) || 0;
      setPreviousDailyWage(dailyWageNum);

      const scheduleId =
        record.schedule_id !== undefined && record.schedule_id !== null
          ? Number(record.schedule_id)
          : null;

      setWageData({
        id: record.id ?? null,
        schedule_id: scheduleId,
        dailyWage: dailyWageNum,
        dailyWageInput: dailyWageNum.toFixed(2),
        vacationLeave: Number(record.vacation_leave_per_year) || 0,
        sickLeave: Number(record.sick_leave_per_year) || 0,
        isPaidHoliday: Number(record.paid_holiday) === 1,
        isCard: Number(record.isCard) === 1,
        sss: String(record.sss_contribution_monthly ?? "0.00"),
        pagibig: String(record.pagibig_contribution_monthly ?? "0.00"),
        philhealth: String(record.philhealth_contribution_monthly ?? "0.00"),
        lastUpdatedBy: fullName || "",
        lastUpdateDate: lastDate,
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to load wage data.");
    }
  };

  const loadSalarySchedules = async () => {
    try {
      const rows = await wageApi.fetchSalarySchedules();
      setSalarySchedules(rows);
    } catch (e) {
      console.error("[Wage] Failed to load salary schedules", e);
      // Non-critical; leave list empty so tab degrades gracefully
    }
  };

  const saveWageData = async () => {
      const loggedUser = getLoggedUser();
      if (!loggedUser) {
        toast.error("Session missing.");
        return;
      }

    if (!selectedEmployee) {
      toast.error("No employee selected.");
      return;
    }

    setConfirmConfig({
      title: "Save compensation settings?",
      description: `You are about to save changes for ${selectedEmployee.user_fname}.`,
      onConfirm: () => executeSaveWageData(Number(loggedUser.user_id)),
    });
    setConfirmOpen(true);
  };

  const executeSaveWageData = async (loggedUserId: number) => {
    if (!selectedEmployee) return;

    const now = new Date();
    const todayYmd = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    let currentRecord = null;
    try {
      currentRecord = await wageApi.fetchWageByUser(selectedEmployee.user_id);
    } catch (e) {
      console.error("[Wage] Failed to refetch current wage record", e);
      currentRecord = null;
    }

    const existingId =
      (currentRecord?.id ?? null) !== null
        ? Number(currentRecord?.id)
        : wageData.id;

    const prevWageNum =
      currentRecord?.daily_wage !== undefined &&
      currentRecord?.daily_wage !== null
        ? Number(currentRecord.daily_wage) || 0
        : previousDailyWage !== null
        ? previousDailyWage
        : 0;

    const nextWageNum = Number(wageData.dailyWage) || 0;

    const prevWageFixed = prevWageNum.toFixed(2);
    const nextWageFixed = nextWageNum.toFixed(2);

    const wageChanged =
      existingId !== null ? prevWageFixed !== nextWageFixed : nextWageNum > 0;

    const payload: WagePayload = {
      user_id: selectedEmployee.user_id,
      daily_wage: nextWageNum,
      vacation_leave_per_year: Number(wageData.vacationLeave) || 0,
      sick_leave_per_year: Number(wageData.sickLeave) || 0,
      paid_holiday: wageData.isPaidHoliday ? 1 : 0,
      isCard: wageData.isCard ? 1 : 0,
      updated_by: loggedUserId,
      sss_contribution_monthly: wageData.sss,
      pagibig_contribution_monthly: wageData.pagibig,
      philhealth_contribution_monthly: wageData.philhealth,
      // Persist the salary grade link (null clears it)
      schedule_id: wageData.schedule_id ?? null,
      ...(wageChanged ? { cutoff_wage_date_update: todayYmd } : {}),
    };

    try {
      if (existingId) {
        await wageApi.patchWage(existingId, payload);
      } else {
        payload.cutoff_wage_date_update = todayYmd;
        await wageApi.createWage(payload);
      }

      if (wageChanged) {
        try {
          const cutoff = await wageApi.findCutoffSettingByDate(todayYmd);
          const cutoffId =
            cutoff?.id !== undefined && cutoff?.id !== null
              ? Number(cutoff.id)
              : null;

          let fallbackCutoffId = cutoffId;
          if (!fallbackCutoffId) {
            const currentDay = now.getDate();
            // If day is 26th up to end of month, or 1st up to 10th
            if (currentDay >= 26 || currentDay <= 10) {
              fallbackCutoffId = 1;
            } else {
              // Day is 11th up to 25th
              fallbackCutoffId = 2;
            }
            
            console.warn(
              "[Wage] No cutoff_settings row matched date",
              todayYmd,
              `- proceeding with fallback cutoff_id = ${fallbackCutoffId}`
            );
          }

          console.log("[Wage] Attempting to create proration log...", {
            user_id: selectedEmployee.user_id,
            previous_daily_wage: existingId ? Number(prevWageFixed) : 0,
            new_daily_wage: Number(nextWageFixed),
            effective_date: todayYmd,
            cutoff_id: fallbackCutoffId,
            updated_by: loggedUserId,
          });

          await wageApi.createWageProrationLog({
            user_id: selectedEmployee.user_id,
            previous_daily_wage: existingId ? Number(prevWageFixed) : 0,
            new_daily_wage: Number(nextWageFixed),
            effective_date: todayYmd,
            cutoff_id: fallbackCutoffId,
            updated_by: loggedUserId,
          });
          console.log("[Wage] Proration log created successfully!");
        } catch (e: unknown) {
          console.error("[Wage] Proration log failed to create", e);
          const msg = e instanceof Error ? e.message : String(e);
          toast.error(
            `Wage saved, but proration log failed: ${msg}. Check console.`
          );
        }
      }

      toast.success("Wage information saved.");
      await loadWageData(selectedEmployee.user_id);
      setModalOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save wage data.");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 font-sans">
        <div className="flex flex-col gap-1 px-1 max-w-7xl mx-auto w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                {activeTab === "wage"
                  ? "Wage Management"
                  : "Salary Grade Management"}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {activeTab === "wage"
                  ? "Manage individual employee wage configurations and records."
                  : "Manage standardized salary schedules and grade steps."}
              </p>
            </div>
          </div>
          <Separator className="mt-4" />
        </div>

        <div className="max-w-7xl mx-auto w-full mt-4">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex flex-col gap-0">
            <div className="flex relative z-10 w-full mb-[-1px] pl-4">
              <TabsList className="bg-transparent p-0 h-auto gap-1 border-b-0 w-fit flex justify-start items-end">
                <TabsTrigger 
                  value="wage" 
                  className="relative flex-none w-auto flex-row items-center gap-2 rounded-t-lg rounded-b-none border border-border border-b-0 px-4 py-2 text-sm font-semibold transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=inactive]:bg-muted/50 data-[state=inactive]:border-transparent data-[state=inactive]:text-muted-foreground hover:data-[state=inactive]:bg-muted data-[state=active]:z-20 data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:-bottom-[1px] data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-card shadow-none data-[state=active]:shadow-none"
                >
                  <Wallet className="w-4 h-4 -ml-0.5" />
                  Wage Management
                </TabsTrigger>
                <TabsTrigger 
                  value="salary-grade" 
                  className="relative flex-none w-auto flex-row items-center gap-2 rounded-t-lg rounded-b-none border border-border border-b-0 px-4 py-2 text-sm font-semibold transition-all data-[state=active]:bg-card data-[state=active]:text-primary data-[state=inactive]:bg-muted/50 data-[state=inactive]:border-transparent data-[state=inactive]:text-muted-foreground hover:data-[state=inactive]:bg-muted data-[state=active]:z-20 data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:-bottom-[1px] data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-card shadow-none data-[state=active]:shadow-none"
                >
                  <TrendingUp className="w-4 h-4 -ml-0.5" />
                  Salary Grade
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="wage" className="mt-0 outline-none relative z-0">
              <Card className="border shadow-sm bg-white dark:bg-gray-900 py-0 rounded-tl-none">
                <CardContent className="p-6">
                  {isTabLoading ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-10 w-[200px]" />
                        <Skeleton className="h-10 w-[250px]" />
                      </div>
                      <div className="space-y-2 mt-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    </div>
                  ) : (
                    <EmployeeTable
                      employees={employees}
                      departments={departments}
                      loading={loading}
                      selectedDept={selectedDept}
                      setSelectedDept={setSelectedDept}
                      searchTerm={searchTerm}
                      setSearchTerm={setSearchTerm}
                      onOpenPassword={openPasswordDialog}
                      handleSort={handleSort as (key: keyof Employee) => void}
                      rowsPerPage={rowsPerPage}
                      currentPage={currentPage}
                      setCurrentPage={setCurrentPage}
                      totalEmployees={totalEmployees}
                      onRefresh={handleRefresh}
                      onReset={handleReset}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="salary-grade" className="mt-0 outline-none relative z-0">
              <Card className="border shadow-sm bg-white dark:bg-gray-900 py-0 rounded-tl-none">
                <CardContent className="p-6">
                  {isTabLoading ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Skeleton className="h-10 w-[200px]" />
                        <Skeleton className="h-10 w-[150px]" />
                      </div>
                      <div className="space-y-2 mt-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    </div>
                  ) : (
                    <SalaryGradeManagement />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <PasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        onSubmit={handlePasswordSubmit}
      />

      {confirmConfig && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirmConfig.title}
          description={confirmConfig.description}
          onConfirm={confirmConfig.onConfirm}
        />
      )}

      <WageModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        selectedEmployee={selectedEmployee}
        wageData={wageData}
        setWageData={(upd) => setWageData((prev) => ({ ...prev, ...upd }))}
        onSave={saveWageData}
        salarySchedules={salarySchedules}
      />
    </DashboardLayout>
  );
}

export default WageModule;
