// @modules/wage/WageModule.tsx
"use client";
import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

import type { Department, Employee, WagePayload, WageDataState, SalarySchedule } from "./types";
import * as wageApi from "./providers/wageApi"; // ✅ correct path

import EmployeeTable from "./components/EmployeeTable";
import PasswordDialog from "./components/PasswordDialog";
import WageModal from "./components/WageModal";
import { SalaryGradeManagement } from "./components/SalaryGradeManagement";

export function WageModule() {
  const [activeTab, setActiveTab] = useState("wage");
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

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Sort & Pagination
  const [sortField, setSortField] = useState<keyof Employee>("user_id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

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

  useEffect(() => {
    wageApi.fetchDepartments().then(setDepartments).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
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
      const session = sessionStorage.getItem("user");
      if (!session) return alert("User not logged in.");
      const logged = JSON.parse(session);

      const apiUser = await wageApi.fetchUserById(logged.user_id);
      if (!apiUser) return alert("User record not found.");
      if (passwordInput !== apiUser.user_password)
        return alert("Incorrect password.");
      if (!selectedEmployee) return alert("No employee selected.");

      const ts = new Date().toISOString();
      const remarks = `Opened wage modal for ${selectedEmployee.user_fname} ${selectedEmployee.user_lname} at ${ts}`;
      await wageApi.logWageAccess(
        logged.user_id,
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
      alert("Error verifying password. Try again.");
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
    const session = sessionStorage.getItem("user");
    if (!session) return alert("User session missing.");
    const logged = JSON.parse(session);

    if (!selectedEmployee) return alert("No employee selected.");
    if (!window.confirm(`Save settings for ${selectedEmployee.user_fname}?`))
      return;

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
      updated_by: logged.user_id,
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
            updated_by: logged.user_id,
          });

          await wageApi.createWageProrationLog({
            user_id: selectedEmployee.user_id,
            previous_daily_wage: existingId ? Number(prevWageFixed) : 0,
            new_daily_wage: Number(nextWageFixed),
            effective_date: todayYmd,
            cutoff_id: fallbackCutoffId,
            updated_by: logged.user_id,
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

            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="w-full sm:w-auto mt-2 sm:mt-0"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="wage">Wage Management</TabsTrigger>
                <TabsTrigger value="salary-grade">Salary Grade</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Separator className="mt-4" />
        </div>

        <div className="max-w-7xl mx-auto w-full">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsContent value="wage" className="mt-0 outline-none">
              <Card className="border shadow-sm bg-white dark:bg-gray-900 py-0">
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
                      setRowsPerPage={setRowsPerPage}
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

            <TabsContent value="salary-grade" className="mt-0 outline-none">
              <Card className="border shadow-sm bg-white dark:bg-gray-900 py-0">
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
