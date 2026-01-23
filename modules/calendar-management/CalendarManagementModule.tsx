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
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Separator } from "@/components/ui/separator";

import type { Holiday, CalendarUser as UserType } from "./types";

export function CalendarManagementModule() {
  // ---------------------- State & Logic ----------------------
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);

  // Calendar Navigation State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Animation State
  const [flashingDate, setFlashingDate] = useState<string | null>(null);

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);

  // Form States
  const [holidayDate, setHolidayDate] = useState("");
  const [description, setDescription] = useState("");
  const [holidayType, setHolidayType] = useState("regular");
  const [isRecurring, setIsRecurring] = useState(true);
  const [isPaid, setIsPaid] = useState(true);
  const [editingHolidayId, setEditingHolidayId] = useState<number | null>(null);

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // ---------------------- Mock Data ----------------------
  useEffect(() => {
    const mockHolidays: Holiday[] = [
      {
        id: 1,
        holiday_date: "2025-01-01",
        description: "New Year's Day",
        holiday_type: "regular",
        is_recurring: true,
        is_paid: true,
        created_by: 1,
      },
      {
        id: 2,
        holiday_date: "2025-02-14",
        description: "Valentine's Day",
        holiday_type: "special",
        is_recurring: true,
        is_paid: false,
        created_by: 1,
      },
      {
        id: 3,
        holiday_date: "2025-03-17",
        description: "Company Foundation Day",
        holiday_type: "company",
        is_recurring: true,
        is_paid: true,
        created_by: 1,
      },
      {
        id: 4,
        holiday_date: "2025-04-18",
        description: "Good Friday",
        holiday_type: "regular",
        is_recurring: true,
        is_paid: true,
        created_by: 1,
      },
      {
        id: 5,
        holiday_date: "2025-05-01",
        description: "Labor Day",
        holiday_type: "regular",
        is_recurring: true,
        is_paid: true,
        created_by: 1,
      },
      {
        id: 6,
        holiday_date: "2025-06-12",
        description: "Independence Day",
        holiday_type: "regular",
        is_recurring: true,
        is_paid: true,
        created_by: 1,
      },
      {
        id: 7,
        holiday_date: "2025-07-04",
        description: "Mid-Year Company Event",
        holiday_type: "company",
        is_recurring: false,
        is_paid: true,
        created_by: 1,
      },
      {
        id: 8,
        holiday_date: "2025-08-21",
        description: "Summer Outing",
        holiday_type: "special",
        is_recurring: false,
        is_paid: false,
        created_by: 1,
      },
      {
        id: 9,
        holiday_date: "2025-09-15",
        description: "Team Building Day",
        holiday_type: "company",
        is_recurring: false,
        is_paid: true,
        created_by: 1,
      },
      {
        id: 10,
        holiday_date: "2025-10-31",
        description: "Halloween Party",
        holiday_type: "special",
        is_recurring: true,
        is_paid: false,
        created_by: 1,
      },
      {
        id: 11,
        holiday_date: "2025-11-01",
        description: "All Saints' Day",
        holiday_type: "regular",
        is_recurring: true,
        is_paid: true,
        created_by: 1,
      },
      {
        id: 12,
        holiday_date: "2025-12-25",
        description: "Christmas Day",
        holiday_type: "regular",
        is_recurring: true,
        is_paid: true,
        created_by: 1,
      },
      {
        id: 13,
        holiday_date: "2025-12-31",
        description: "New Year's Eve",
        holiday_type: "special",
        is_recurring: true,
        is_paid: false,
        created_by: 1,
      },
    ];

    const mockUsers: UserType[] = [{ user_id: 1, user_fname: "Zarina", user_lname: "Carcha" }];

    setHolidays(mockHolidays);
    setUsers(mockUsers);
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
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const d = String(selectedDate.getDate()).padStart(2, "0");
      setHolidayDate(`${y}-${m}-${d}`);
    } else {
      setHolidayDate("");
    }
    setDescription("");
    setHolidayType("regular");
    setIsRecurring(true);
    setIsPaid(true);
    setEditingHolidayId(null);
  };

  const handleEdit = (e: React.MouseEvent, h: Holiday) => {
    e.stopPropagation(); // Prevent triggering the row click
    setHolidayDate(h.holiday_date);
    setDescription(h.description);
    setHolidayType(h.holiday_type);
    setIsRecurring(h.is_recurring === 1 || h.is_recurring === true);
    setIsPaid(h.is_paid === 1 || h.is_paid === true);
    setEditingHolidayId(h.id);
    setModalOpen(true);
  };

  const handleSaveHoliday = async () => {
    if (!holidayDate || !description) {
      alert("Please fill all required fields");
      return;
    }

    const newHoliday: Holiday = {
      id: editingHolidayId || Date.now(),
      holiday_date: holidayDate,
      description,
      holiday_type: holidayType,
      is_recurring: isRecurring,
      is_paid: isPaid,
      created_by: 1,
    };

    if (editingHolidayId) {
      setHolidays(holidays.map((h) => (h.id === editingHolidayId ? newHoliday : h)));
    } else {
      setHolidays([...holidays, newHoliday]);
    }

    setModalOpen(false);
    resetForm();
  };

  const handleDeleteHoliday = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Prevent triggering the row click
    if (!confirm("Delete this holiday?")) return;
    setHolidays(holidays.filter((h) => h.id !== id));
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
    const { daysInMonth, startingDayOfWeek, year, month } = useMemo(() => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      return {
        daysInMonth: lastDay.getDate(),
        startingDayOfWeek: firstDay.getDay(),
        year,
        month,
      };
    }, []);

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
      const dotColor = isSpecial ? "bg-amber-500" : "bg-blue-500";

      days.push(
        <button
          key={day}
          onClick={() => setSelectedDate(currentDayDate)}
          className={`
            relative h-10 w-10 p-0 rounded-full flex items-center justify-center transition-all duration-300 text-sm group
            ${
              isSelected
                ? "bg-blue-600 text-white shadow-md scale-105"
                : "hover:bg-gray-100 text-gray-700"
            }
            ${isToday && !isSelected ? "text-blue-600 font-bold border border-blue-200" : ""}
            ${isFlashing ? "ring-4 ring-blue-300 scale-125 z-10" : ""} 
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
          <span className="text-lg font-bold text-gray-900">
            {monthNames[month]} <span className="text-gray-500 font-normal">{year}</span>
          </span>
          <div className="flex gap-1">
            <button
              onClick={() =>
                setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
              }
              className="h-8 w-8 bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200 rounded-md flex items-center justify-center transition-all shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() =>
                setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
              }
              className="h-8 w-8 bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200 rounded-md flex items-center justify-center transition-all shadow-sm"
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
                className="h-8 text-center text-gray-400 text-[11px] font-semibold uppercase tracking-wider flex items-center justify-center"
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

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 h-full p-6 bg-gray-50 font-sans">
        {/* HEADER */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Calendar Management
            </h1>
            <p className="text-sm text-gray-600">
              Manage company holidays, non-working days, and events.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Event
          </button>
        </div>
        <Separator />

        {/* --- TOP ROW --- */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[500px]">
          {/* 1. CALENDAR VIEW */}
          <div className="xl:col-span-3 flex flex-col h-full overflow-hidden">
            <div className="h-full border rounded-lg shadow-sm flex flex-col overflow-hidden bg-white">
              <div className="py-3 px-5 border-b bg-white flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-800">
                  <CalendarIcon className="w-4 h-4 text-blue-600" />
                  Pick a Date
                </h3>
              </div>
              <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                <SimpleCalendar />

                {/* Selected Date Context Info (UPDATED WITH DETAILS) */}
                {selectedDate && (
                  <div className="mt-auto pt-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Selected Date
                        </p>
                      </div>
                      <p className="text-base font-bold text-gray-900 mb-3">
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
                                  className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm transition-all hover:shadow-md"
                                >
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <span className="text-sm font-semibold text-gray-800 leading-tight">
                                      {event.description}
                                    </span>
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide shrink-0 ${
                                        event.holiday_type === "special"
                                          ? "bg-amber-100 text-amber-700"
                                          : event.holiday_type === "company"
                                          ? "bg-blue-100 text-blue-700"
                                          : "bg-gray-100 text-gray-700"
                                      }`}
                                    >
                                      {event.holiday_type}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {event.is_recurring && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                        <div className="w-1 h-1 rounded-full bg-purple-500"></div>{" "}
                                        Recurring
                                      </span>
                                    )}
                                    {event.is_paid && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500"></div>{" "}
                                        Paid
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1.5 pt-2 border-t border-gray-50">
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
            <div className="flex-1 flex flex-col border rounded-lg shadow-sm overflow-hidden bg-white">
              {/* Top Bar */}
              <div className="px-5 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
                <div>
                  <h2 className="text-sm font-semibold">Events List</h2>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Overview of scheduled events for {new Date().getFullYear()}.
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    placeholder="Filter events..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 w-full text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 divide-x border-b bg-gray-50">
                <div className="px-5 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors">
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase">Total</p>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-bold">{stats.total}</span>
                      <span className="text-xs text-gray-600">entries</span>
                    </div>
                  </div>
                  <CalendarIcon className="w-8 h-8 p-1.5 rounded-full bg-blue-50 text-blue-600" />
                </div>
                <div className="px-5 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors">
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase">Special</p>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-bold text-amber-600">{stats.special}</span>
                      <span className="text-xs text-gray-600">events</span>
                    </div>
                  </div>
                  <Star className="w-8 h-8 p-1.5 rounded-full bg-amber-50 text-amber-600" />
                </div>
                <div className="px-5 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors">
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase">Paid</p>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-bold text-emerald-600">{stats.paid}</span>
                      <span className="text-xs text-gray-600">active</span>
                    </div>
                  </div>
                  <Briefcase className="w-8 h-8 p-1.5 rounded-full bg-emerald-50 text-emerald-600" />
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-20 bg-white shadow-sm">
                    <tr className="border-b text-gray-600">
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
                          className="border-b hover:bg-blue-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-5 py-3 text-xs font-medium group-hover:text-blue-700 transition-colors">
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
                                  ? "bg-blue-100 text-blue-700"
                                  : item.holiday_type === "special"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {item.holiday_type}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs font-medium text-gray-800">
                            {item.description}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-2 text-xs">
                              {item.is_recurring && (
                                <span className="text-gray-600 flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>{" "}
                                  Recurring
                                </span>
                              )}
                              {item.is_paid && (
                                <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{" "}
                                  Paid
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600">
                                <User className="w-3 h-3" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">{getUserName(item.created_by)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={(e) => handleEdit(e, item)}
                                className="p-1.5 hover:bg-blue-100 rounded text-blue-600 transition-colors"
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
              <div className="border-t px-4 py-2 bg-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-600">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <div className="flex gap-1">
                  <button
                    className="h-7 w-7 border bg-white rounded flex items-center justify-center disabled:opacity-50 hover:bg-gray-100"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="h-7 w-7 border bg-white rounded flex items-center justify-center disabled:opacity-50 hover:bg-gray-100"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="h-7 w-7 border bg-white rounded flex items-center justify-center disabled:opacity-50 hover:bg-gray-100"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="h-7 w-7 border bg-white rounded flex items-center justify-center disabled:opacity-50 hover:bg-gray-100"
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
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
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
                  <label className="block text-sm font-medium mb-1.5 text-gray-700">Date</label>
                  <input
                    type="date"
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700">Description</label>
                  <input
                    placeholder="e.g. Christmas Day"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700">Type</label>
                  <select
                    value={holidayType}
                    onChange={(e) => setHolidayType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="regular">Regular</option>
                    <option value="special">Special</option>
                    <option value="company">Company</option>
                  </select>
                </div>
                <div className="flex gap-4 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer p-2 border rounded-lg flex-1 hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={isRecurring as boolean}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Recurring</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 border rounded-lg flex-1 hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={isPaid as boolean}
                      onChange={(e) => setIsPaid(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Paid Holiday</span>
                  </label>
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveHoliday}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors"
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
