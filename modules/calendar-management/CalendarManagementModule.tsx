"use client";

import {
  Pencil,
  Trash2,
  Calendar as CalendarIcon,
  Plus,
  Search,
  Briefcase,
  Star,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  User,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Separator } from "@/components/ui/separator";

import type { Holiday, CalendarUser as UserType } from "./types";
import { CalendarManagementSkeleton } from "./components/CalendarManagementSkeleton";
import * as calendarApi from "./providers/calendarApi";
import { getSessionUserId } from "../cutoff-settings/providers/cutoffSettingsApi";

export function CalendarManagementModule() {
  // ---------------------- State & Logic ----------------------
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar Navigation State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Animation State
  const [flashingDate, setFlashingDate] = useState<string | null>(null);

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);

  // Form States
  const [holidayDate, setHolidayDate] = useState("");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [description, setDescription] = useState("");
  const [holidayType, setHolidayType] = useState("regular");
  const [isRecurring, setIsRecurring] = useState(true);
  const [isPaid, setIsPaid] = useState(true);
  const [editingHolidayId, setEditingHolidayId] = useState<number | null>(null);

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // ---------------------- API Data ----------------------
  const loadData = async () => {
    setLoading(true);
    try {
      const [hData, uData] = await Promise.all([
        calendarApi.fetchHolidays(),
        calendarApi.fetchUsers(),
      ]);
      setHolidays(hData);
      setUsers(uData);
    } catch (err: unknown) {
      console.error("Failed to load calendar data:", err);
      const msg = err instanceof Error ? err.message : "Failed to load data";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // ---------------------- Derived Data ----------------------

  const filteredHolidays = useMemo(() => {
    return holidays.filter(
      (h) =>
        h.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.holiday_date.includes(searchTerm) ||
        h.holiday_type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [holidays, searchTerm]);

  const totalPages = Math.ceil(filteredHolidays.length / ITEMS_PER_PAGE);
  const paginatedHolidays = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredHolidays.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredHolidays, currentPage]);

  const getUserName = (id: number | undefined | null) => {
    if (!id && id !== 0) return "Unknown";
    const u = users.find((x) => x.user_id === id);
    return u ? `${u.user_fname} ${u.user_lname}` : `User ${id}`;
  };

  // ---------------------- Handlers ----------------------
  const resetForm = () => {
    setHolidayDate(selectedDate ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}` : "");
    setLastWorkingDay("");
    setDescription("");
    setHolidayType("regular");
    setIsRecurring(true);
    setIsPaid(true);
    setEditingHolidayId(null);
  };

  const handleEdit = (e: React.MouseEvent, h: Holiday) => {
    e.stopPropagation(); // Prevent triggering the row click
    setHolidayDate(h.holiday_date);
    setLastWorkingDay(h.last_working_day || "");
    setDescription(h.description);
    setHolidayType(h.holiday_type);
    setIsRecurring(h.is_recurring === 1 || h.is_recurring === true);
    setIsPaid(h.is_paid === 1 || h.is_paid === true);
    setEditingHolidayId(h.id);
    setModalOpen(true);
  };

  // Resolve the cutoff_setting_id for a given date by querying the cutoff-settings API.
  const getCutoffSettingId = async (dateStr: string): Promise<number | null> => {
    try {
      const d = new Date(dateStr);
      const month = String(d.getMonth() + 1);
      const year = String(d.getFullYear());
      const day = d.getDate();

      const res = await fetch(`/api/cutoff-settings?month=${month}&year=${year}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;

      const json = await res.json();
      const settings: { id: number; start_date: string; end_date: string }[] = json?.data ?? [];
      if (!settings.length) return null;

      // Prefer the cutoff period whose date range contains the holiday date.
      const matched = settings.find((s) => {
        if (!s.start_date || !s.end_date) return false;
        const start = new Date(s.start_date).getDate();
        const end = new Date(s.end_date).getDate();
        return day >= start && day <= end;
      });

      return (matched ?? settings[0])?.id ?? null;
    } catch {
      return null;
    }
  };

  const handleSaveHoliday = async () => {
    if (!holidayDate || !description) {
      alert("Please fill all required fields");
      return;
    }

    const cutoffSettingId = await getCutoffSettingId(holidayDate);

    const payload: Partial<Holiday> = {
      holiday_date: holidayDate,
      last_working_day: lastWorkingDay || null,
      description,
      holiday_type: holidayType,
      is_recurring: isRecurring ? 1 : 0,
      is_paid: isPaid ? 1 : 0,
      cutoff_setting_id: cutoffSettingId,
      updated_by: Number(getSessionUserId()),
    };

    if (!editingHolidayId) {
      payload.created_by = Number(getSessionUserId());
    }

    try {
      if (editingHolidayId) {
        await calendarApi.updateHoliday(editingHolidayId, payload);
      } else {
        await calendarApi.createHoliday(payload);
      }
      setModalOpen(false);
      resetForm();
      await loadData(); // Reload from DB
      toast.success(editingHolidayId ? "Holiday updated" : "Holiday created");
    } catch (err: unknown) {
      console.error("Failed to save holiday:", err);
      const msg = err instanceof Error ? err.message : "Failed to save holiday";
      toast.error(msg);
    }
  };

  const handleDeleteHoliday = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Prevent triggering the row click
    if (!confirm("Delete this holiday?")) return;
    try {
      await calendarApi.deleteHoliday(id);
      await loadData();
      toast.success("Holiday deleted");
    } catch (err: unknown) {
      console.error("Failed to delete holiday:", err);
      const msg = err instanceof Error ? err.message : "Failed to delete";
      toast.error(msg);
    }
  };

  // --- Handle Event Click from Table ---
  const handleEventClick = (dateStr: string) => {
    const targetDate = new Date(dateStr);

    // 1. Select the date
    setSelectedDate(targetDate);

    // 2. Switch calendar to that month if not already visible
    if (
      targetDate.getMonth() !== currentMonth.getMonth() ||
      targetDate.getFullYear() !== currentMonth.getFullYear()
    ) {
      setCurrentMonth(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
    }

    // 3. Trigger Flash Animation
    setFlashingDate(dateStr);

    // 4. Remove Flash after animation completes (1s)
    setTimeout(() => {
      setFlashingDate(null);
    }, 1000);
  };

  const stats = useMemo(() => {
    const total = holidays.length;
    const special = holidays.filter((h) => h.holiday_type === "special").length;
    const paid = holidays.filter((h) => h.is_paid).length;
    return { total, special, paid };
  }, [holidays]);

  // ---------------------- Calendar Component ----------------------
  const SimpleCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-10"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDayDate = new Date(year, month, day);
      const dateStringIso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const isToday = new Date().toDateString() === currentDayDate.toDateString();
      const isSelected = selectedDate?.toDateString() === currentDayDate.toDateString();
      const isFlashing = flashingDate === dateStringIso;

      const dayEvents = holidays.filter((h) => h.holiday_date === dateStringIso);
      const hasEvent = dayEvents.length > 0;

      const isSpecial = dayEvents.some((h) => h.holiday_type === "special");
      const dotColor = isSpecial ? "bg-amber-500" : "bg-primary";

      days.push(
        <button
          key={day}
          onClick={() => setSelectedDate(currentDayDate)}
          className={`
            relative h-10 w-10 p-0 rounded-full flex items-center justify-center transition-all duration-300 text-sm group
            ${
              isSelected
                ? "bg-primary text-white shadow-md scale-105"
                : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            }
            ${isToday && !isSelected ? "text-primary font-bold border border-primary/20 dark:border-primary/30" : ""}
            ${isFlashing ? "ring-4 ring-blue-300 dark:ring-blue-900 scale-125 z-10" : ""} 
          `}
        >
          <span className="z-10">{day}</span>

          {hasEvent && !isSelected && (
            <span className={`absolute bottom-1.5 h-1 w-1 rounded-full ${dotColor}`}></span>
          )}
          {hasEvent && isSelected && (
            <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-white/70"></span>
          )}
        </button>
      );
    }

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    return (
      <div className="w-full h-full flex flex-col">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6 px-1">
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {monthNames[month]} <span className="text-gray-500 dark:text-gray-400 font-normal">{year}</span>
          </span>
          <div className="flex gap-1">
            <button
              onClick={() =>
                setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
              }
              className="h-8 w-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary/70 hover:border-primary/20 dark:hover:border-blue-800 rounded-md flex items-center justify-center transition-all shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() =>
                setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
              }
              className="h-8 w-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary/70 hover:border-primary/20 dark:hover:border-blue-800 rounded-md flex items-center justify-center transition-all shadow-sm"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Days Grid */}
        <div className="w-full">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="h-8 text-center text-gray-400 dark:text-gray-500 text-[11px] font-semibold uppercase tracking-wider flex items-center justify-center"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-2 gap-x-1 place-items-center">{days}</div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <CalendarManagementSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 h-full p-6 bg-gray-50 dark:bg-gray-950 font-sans">
        {/* HEADER */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Calendar Management
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage company holidays, non-working days, and events.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Event
          </button>
        </div>
        <Separator />

        {/* --- TOP ROW --- */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[500px]">
          {/* 1. CALENDAR VIEW */}
          <div className="xl:col-span-3 flex flex-col h-full overflow-hidden">
            <div className="h-full border dark:border-gray-700 rounded-lg shadow-sm flex flex-col overflow-hidden bg-white dark:bg-gray-900">
              <div className="py-3 px-5 border-b dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                  <CalendarIcon className="w-4 h-4 text-primary dark:text-primary/70" />
                  Pick a Date
                </h3>
              </div>
              <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                <SimpleCalendar />

                {/* Selected Date Context Info (UPDATED WITH DETAILS) */}
                {selectedDate && (
                  <div className="mt-auto pt-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-2 w-2 rounded-full bg-primary"></div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Selected Date
                        </p>
                      </div>
                      <p className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3">
                        {selectedDate.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>

                      {(() => {
                        // Find events for the selected date
                        const dayEvents = holidays.filter(
                          (h) =>
                            new Date(h.holiday_date).toDateString() ===
                            selectedDate.toDateString()
                        );

                        if (dayEvents.length > 0) {
                          return (
                            <div className="space-y-3">
                              {dayEvents.map((event) => (
                                <div
                                  key={event.id}
                                  className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:shadow-md"
                                >
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                                      {event.description}
                                    </span>
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide shrink-0 ${
                                        event.holiday_type === "special"
                                          ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                                          : event.holiday_type === "company"
                                          ? "bg-primary/10 dark:bg-primary/15 text-primary dark:text-primary/70"
                                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                      }`}
                                    >
                                      {event.holiday_type}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {event.is_recurring && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-700">
                                        <div className="w-1 h-1 rounded-full bg-purple-500"></div>{" "}
                                        Recurring
                                      </span>
                                    )}
                                    {event.is_paid ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/40">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500"></div>{" "}
                                        Paid
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-900/40">
                                        <div className="w-1 h-1 rounded-full bg-red-500"></div>{" "}
                                        Unpaid
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5 pt-2 border-t border-gray-50 dark:border-gray-800">
                                    <User className="w-3 h-3" />
                                    <span>Added by {getUserName(event.created_by)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        } else {
                          return (
                            <p className="text-xs text-gray-500 italic">
                              No events scheduled for this day.
                            </p>
                          );
                        }
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. EVENTS TABLE */}
          <div className="xl:col-span-9 flex flex-col h-full overflow-hidden">
            <div className="flex-1 flex flex-col border dark:border-gray-700 rounded-lg shadow-sm overflow-hidden bg-white dark:bg-gray-900">
              {/* Top Bar */}
              <div className="px-5 py-3 border-b dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <div>
                  <h2 className="text-sm font-semibold">Events List</h2>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    Overview of scheduled events for {new Date().getFullYear()}.
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                  <input
                    placeholder="Filter events..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:text-gray-200"
                  />
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 divide-x dark:divide-gray-700 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="px-5 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Total</p>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">entries</span>
                    </div>
                  </div>
                  <CalendarIcon className="w-8 h-8 p-1.5 rounded-full bg-primary/5 dark:bg-primary/15 text-primary dark:text-primary/70" />
                </div>
                <div className="px-5 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Special</p>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-bold text-amber-600 dark:text-amber-500">{stats.special}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">events</span>
                    </div>
                  </div>
                  <Star className="w-8 h-8 p-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500" />
                </div>
                <div className="px-5 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Paid</p>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-500">{stats.paid}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">active</span>
                    </div>
                  </div>
                  <Briefcase className="w-8 h-8 p-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-500" />
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-20 bg-white dark:bg-gray-900 shadow-sm">
                    <tr className="border-b dark:border-gray-700 text-gray-600 dark:text-gray-400">
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase">Date</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold uppercase">Type</th>
                      <th className="text-left px-3 py-3 text-xs font-semibold uppercase">
                        Description
                      </th>
                      <th className="text-left px-3 py-3 text-xs font-semibold uppercase">
                        Attributes
                      </th>
                      <th className="text-left px-3 py-3 text-xs font-semibold uppercase">
                        Author
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-semibold uppercase">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHolidays.length > 0 ? (
                      paginatedHolidays.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => handleEventClick(item.holiday_date)}
                          className="border-b dark:border-gray-800 hover:bg-primary/5/50 dark:hover:bg-primary/10 transition-colors cursor-pointer group"
                        >
                          <td className="px-5 py-3 text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary dark:group-hover:text-primary/70 transition-colors">
                            {new Date(item.holiday_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`px-2 py-1 text-[10px] rounded-full font-medium uppercase tracking-wide ${
                                item.holiday_type === "company"
                                  ? "bg-primary/10 dark:bg-primary/15 text-primary dark:text-primary/70"
                                  : item.holiday_type === "special"
                                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {item.holiday_type}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs font-medium text-gray-800 dark:text-gray-200">
                            {item.description}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-2 text-xs">
                              {item.is_recurring && (
                                <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>{" "}
                                  Recurring
                                </span>
                              )}
                              {item.is_paid ? (
                                <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{" "}
                                  Paid
                                </span>
                              ) : (
                                <span className="text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>{" "}
                                  Unpaid
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] text-gray-600 dark:text-gray-400">
                                <User className="w-3 h-3" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{getUserName(item.created_by)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={(e) => handleEdit(e, item)}
                                className="p-1.5 hover:bg-primary/10 rounded text-primary transition-colors"
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteHoliday(e, item.id)}
                                className="p-1.5 hover:bg-red-100 rounded text-red-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <Search className="w-8 h-8 text-gray-300" />
                            <p>No events found matching your criteria.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="border-t dark:border-gray-700 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <div className="flex gap-1">
                  <button
                    className="h-7 w-7 border dark:border-gray-700 bg-white dark:bg-gray-800 rounded flex items-center justify-center disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="h-7 w-7 border dark:border-gray-700 bg-white dark:bg-gray-800 rounded flex items-center justify-center disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="h-7 w-7 border dark:border-gray-700 bg-white dark:bg-gray-800 rounded flex items-center justify-center disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="h-7 w-7 border dark:border-gray-700 bg-white dark:bg-gray-800 rounded flex items-center justify-center disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border dark:border-gray-800">
              <div className="px-6 py-4 border-b dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {editingHolidayId ? "Edit Holiday" : "Add Holiday"}
                </h2>
                <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Date</label>
                  <input
                    type="date"
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Last Working Day (Optional)</label>
                  <input
                    type="date"
                    value={lastWorkingDay}
                    onChange={(e) => setLastWorkingDay(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Description</label>
                  <input
                    placeholder="e.g. Christmas Day"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Type</label>
                  <select
                    value={holidayType}
                    onChange={(e) => setHolidayType(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="regular">Regular</option>
                    <option value="special">Special</option>
                    <option value="company">Company</option>
                  </select>
                </div>
                <div className="flex gap-4 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer p-2 border dark:border-gray-700 rounded-lg flex-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={isRecurring as boolean}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-4 h-4 text-primary rounded focus:ring-primary border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Recurring</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 border dark:border-gray-700 rounded-lg flex-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={isPaid as boolean}
                      onChange={(e) => setIsPaid(e.target.checked)}
                      className="w-4 h-4 text-primary rounded focus:ring-primary border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Paid Holiday</span>
                  </label>
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t dark:border-gray-800">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveHoliday}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium shadow-sm transition-colors"
                  >
                    Save Event
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
