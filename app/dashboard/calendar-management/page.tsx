"use client";

import { Pencil, Trash2, Calendar as IconCalendar } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface Holiday {
  id: number;
  holiday_date: string; // "YYYY-MM-DD"
  description: string;
  holiday_type: string;
  is_recurring: boolean | number;
  is_paid: boolean | number;
  created_by: number;
  created_date?: string;
  updated_by?: number | null;
  updated_date?: string | null;
}

interface User {
  user_id: number;
  user_fname: string;
  user_lname: string;
}

interface HolidayPayload {
  holiday_date: string;
  description: string;
  holiday_type: string;
  is_recurring: number;
  is_paid: number;
  created_by?: number;
  updated_by?: number;
  updated_date?: string;
}

export default function CalendarManagementPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [holidayDate, setHolidayDate] = useState("");
  const [description, setDescription] = useState("");
  const [holidayType, setHolidayType] = useState("regular");
  const [isRecurring, setIsRecurring] = useState(true);
  const [isPaid, setIsPaid] = useState(true);
  const [editingHolidayId, setEditingHolidayId] = useState<number | null>(null);

  const [blinkDateIso, setBlinkDateIso] = useState<string | null>(null);
  const calendarWrapRef = useRef<HTMLDivElement | null>(null);

  const [searchTerm, setSearchTerm] = useState("");

  // ---------------------- load data ----------------------
  const loadHolidays = async () => {
    try {
      const res = await fetch(
        "http://100.126.246.124:8060/items/holiday_calendar"
      );
      const json = await res.json();
      setHolidays(json.data || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load holidays.");
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch("http://100.126.246.124:8060/items/user");
      const json = await res.json();
      setUsers(json.data || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load users.");
    }
  };

  useEffect(() => {
    loadHolidays();
    loadUsers();
  }, []);

  // const isoDate = (d: Date) => d.toISOString().substring(0, 10);

  const holidayDateList = useMemo(() => {
    return [...new Set(holidays.map((h) => h.holiday_date))].map(
      (s) => new Date(s)
    );
  }, [holidays]);

  const upcomingEvents = useMemo(() => {
    return holidays
      .map((h) => ({ ...h, dateObj: new Date(h.holiday_date) }))
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .slice(0, 10);
  }, [holidays]);

  const filteredHolidays = useMemo(() => {
    return holidays.filter(
      (h) =>
        h.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.holiday_date.includes(searchTerm) ||
        h.holiday_type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [holidays, searchTerm]);

  const getUserName = (id: number | undefined | null) => {
    if (!id && id !== 0) return "Unknown";
    const u = users.find((x) => x.user_id === id);
    return u ? `${u.user_fname} ${u.user_lname}` : `User ${id}`;
  };

  // ---------------------- modal helpers ----------------------
  const resetForm = () => {
    setHolidayDate("");
    setDescription("");
    setHolidayType("regular");
    setIsRecurring(true);
    setIsPaid(true);
    setEditingHolidayId(null);
  };

  const handleEdit = (h: Holiday) => {
    setHolidayDate(h.holiday_date);
    setDescription(h.description);
    setHolidayType(h.holiday_type);
    setIsRecurring(h.is_recurring === 1 || h.is_recurring === true);
    setIsPaid(h.is_paid === 1 || h.is_paid === true);
    setEditingHolidayId(h.id);
    setModalOpen(true);
  };

  // ---------------------- save holiday ----------------------
  const handleSaveHoliday = async () => {
    try {
      const session = sessionStorage.getItem("user");
      if (!session) return toast.error("User session missing.");
      const logged = JSON.parse(session);

      if (!holidayDate || !description)
        return toast.error("Please fill all fields.");

      const duplicate = holidays.find(
        (h) =>
          h.holiday_date === holidayDate &&
          h.holiday_type === holidayType &&
          h.id !== editingHolidayId
      );
      if (duplicate)
        return toast.error("Holiday with this date and type already exists.");

      const payload: HolidayPayload = {
        holiday_date: holidayDate,
        description,
        holiday_type: holidayType,
        is_recurring: isRecurring ? 1 : 0,
        is_paid: isPaid ? 1 : 0,
      };

      if (editingHolidayId) {
        payload.updated_by = logged.user_id;
        payload.updated_date = new Date().toISOString();

        const res = await fetch(
          `http://100.126.246.124:8060/items/holiday_calendar/${editingHolidayId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        if (!res.ok) {
          const err = await res.json();
          if (err?.errors?.[0]?.code === "RECORD_NOT_UNIQUE") {
            return toast.error(
              "Holiday with this date and type already exists."
            );
          }
          throw new Error(`HTTP ${res.status}`);
        }

        toast.success("Holiday updated successfully!");
      } else {
        payload.created_by = logged.user_id;

        const res = await fetch(
          "http://100.126.246.124:8060/items/holiday_calendar",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        if (!res.ok) {
          const err = await res.json();
          if (err?.errors?.[0]?.code === "RECORD_NOT_UNIQUE") {
            return toast.error(
              "Holiday with this date and type already exists."
            );
          }
          throw new Error(`HTTP ${res.status}`);
        }

        toast.success("Holiday added successfully!");
      }

      setModalOpen(false);
      resetForm();
      await loadHolidays();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save holiday.");
    }
  };

  // ---------------------- delete ----------------------
  const handleDeleteHoliday = async (id: number) => {
    if (!confirm("Delete this holiday?")) return;
    try {
      const res = await fetch(
        `http://100.126.246.124:8060/items/holiday_calendar/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Holiday deleted successfully!");
      await loadHolidays();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete holiday.");
    }
  };

  // ---------------------- blink + scroll ----------------------
  useEffect(() => {
    if (!blinkDateIso) return;
    const timeout = setTimeout(() => {
      if (!calendarWrapRef.current) return;
      const el = calendarWrapRef.current.querySelector(".mod-blink");
      if (el && el instanceof HTMLElement) {
        el.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      }
    }, 120);
    const stop = setTimeout(() => setBlinkDateIso(null), 1000);
    return () => {
      clearTimeout(timeout);
      clearTimeout(stop);
    };
  }, [blinkDateIso]);

  const onClickUpcoming = (h: Holiday) => {
    setSelectedDate(new Date(h.holiday_date));
    setBlinkDateIso(h.holiday_date);
  };

  const blinkDateList = blinkDateIso ? [new Date(blinkDateIso)] : [];

  return (
    <DashboardLayout>
      <div className="w-full relative">
        <div className="grid grid-cols-1 md:grid-cols-8 gap-6">
          {/* LEFT: Calendar Overview */}
          <div className="col-span-1 md:col-span-3">
            <Card className="shadow-sm border rounded-xl h-full flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <IconCalendar className="w-5 h-5" />
                  Calendar Overview
                </CardTitle>
              </CardHeader>

              <CardContent className="flex flex-col flex-1">
                <div
                  ref={calendarWrapRef}
                  className="w-full flex justify-center mb-3"
                >
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="w-full max-w-[260px] border rounded-lg p-1 text-sm"
                    showOutsideDays
                    modifiers={{
                      today: new Date(),
                      holidays: holidayDateList,
                      blink: blinkDateList,
                    }}
                    modifiersClassNames={{
                      today:
                        "bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-white font-bold border border-blue-500",
                      holidays:
                        "bg-red-200 dark:bg-red-700 text-red-900 dark:text-white font-semibold border border-red-500 rounded-sm",
                      blink: "mod-blink",
                    }}
                  />
                </div>

                <h3 className="font-medium mb-2">Upcoming Events</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {upcomingEvents.length === 0 ? (
                    <p className="text-gray-500 text-sm">No upcoming events</p>
                  ) : (
                    upcomingEvents.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => onClickUpcoming(h)}
                        className="w-full text-left p-2 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition flex justify-between items-start"
                      >
                        <div>
                          <div className="font-medium">{h.description}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(h.holiday_date).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}{" "}
                            — {h.holiday_type}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 ml-2">
                          <span
                            className={`inline-block w-2 h-2 rounded-full mt-1 ${
                              h.holiday_type === "company"
                                ? "bg-yellow-500"
                                : h.holiday_type === "special"
                                ? "bg-orange-500"
                                : "bg-red-500"
                            }`}
                          />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Holiday Table */}
          <div className="col-span-1 md:col-span-5">
            <Card className="shadow-sm border rounded-xl h-full flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <IconCalendar className="w-5 h-5" />
                  Holiday Calendar
                </CardTitle>
              </CardHeader>

              <CardContent className="flex flex-col flex-1">
                <div className="flex justify-between items-center mb-4 gap-2">
                  <h2 className="text-base font-semibold">List of Holidays</h2>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search by description, date, or type"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-xs"
                    />
                    <Button
                      onClick={() => {
                        resetForm();
                        setModalOpen(true);
                      }}
                    >
                      + Add Holiday
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border overflow-hidden">
                  <div className="max-h-[480px] overflow-y-auto">
                    <table className="w-full border-collapse">
                      {/* Sticky Header */}
                      <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0 z-10">
                        <tr>
                          <th className="border p-2 text-left">No.</th>
                          <th className="border p-2 text-left">Date</th>
                          <th className="border p-2 text-left">Description</th>
                          <th className="border p-2 text-left">Type</th>
                          <th className="border p-2 text-left">Recurring</th>
                          <th className="border p-2 text-left">Paid</th>
                          <th className="border p-2 text-left">
                            Created/Updated By
                          </th>
                          <th className="border p-2 text-left">Actions</th>
                        </tr>
                      </thead>

                      {/* Table Body */}
                      <tbody>
                        {filteredHolidays.length > 0 ? (
                          filteredHolidays.map((item, idx) => (
                            <tr
                              key={item.id}
                              className="hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <td className="border p-2 align-top">
                                {idx + 1}
                              </td>

                              {/* DATE + subtle "Updated" text */}
                              <td className="border p-2 align-top">
                                {new Date(item.holiday_date).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  }
                                )}

                                {item.updated_date && (
                                  <div className="text-[11px] text-gray-400 mt-1">
                                    Updated:{" "}
                                    {new Date(
                                      item.updated_date
                                    ).toLocaleDateString()}
                                  </div>
                                )}
                              </td>

                              <td className="border p-2 align-top">
                                {item.description}
                              </td>
                              <td className="border p-2 align-top">
                                {item.holiday_type}
                              </td>
                              <td className="border p-2 align-top">
                                {item.is_recurring ? "Yes" : "No"}
                              </td>
                              <td className="border p-2 align-top">
                                {item.is_paid ? "Yes" : "No"}
                              </td>

                              {/* CREATED / UPDATED NAME with subtle tag */}
                              <td className="border p-2 align-top">
                                <div className="font-medium">
                                  {item.updated_by
                                    ? getUserName(item.updated_by)
                                    : getUserName(item.created_by)}
                                </div>

                                <div className="text-[11px] text-gray-400">
                                  {item.updated_by ? "Updated" : "Created"}
                                </div>
                              </td>

                              {/* ACTION BUTTONS */}
                              <td className="border p-2 text-center">
                                <div className="flex justify-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(item)}
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteHoliday(item.id)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={8}
                              className="p-4 text-center text-gray-500"
                            >
                              No holidays found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* MODAL */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingHolidayId ? "Edit Holiday" : "Add Holiday"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                />
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  placeholder="Enter holiday description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <Label>Holiday Type</Label>
                <Select
                  value={holidayType}
                  onValueChange={(val) => setHolidayType(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="special">Special</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isRecurring}
                    onCheckedChange={(v) => setIsRecurring(Boolean(v))}
                  />
                  <Label>Recurring</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isPaid}
                    onCheckedChange={(v) => setIsPaid(Boolean(v))}
                  />
                  <Label>Paid</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveHoliday}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
