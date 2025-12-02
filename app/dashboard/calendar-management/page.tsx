"use client";

import { Pencil, Trash2 } from "lucide-react";

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
import { Calendar as IconCalendar } from "lucide-react";
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

export default function CalendarManagementPage() {
  // --- data
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // modal / form
  const [modalOpen, setModalOpen] = useState(false);
  const [holidayDate, setHolidayDate] = useState(""); // yyyy-mm-dd
  const [description, setDescription] = useState("");
  const [holidayType, setHolidayType] = useState("regular");
  const [isRecurring, setIsRecurring] = useState(true);
  const [isPaid, setIsPaid] = useState(true);
  const [editingHolidayId, setEditingHolidayId] = useState<number | null>(null);

  // blink target date ISO (yyyy-mm-dd) when clicking upcoming event
  const [blinkDateIso, setBlinkDateIso] = useState<string | null>(null);
  const calendarWrapRef = useRef<HTMLDivElement | null>(null);

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

  // ---------------------- helpers ----------------------
  const isoDate = (d: Date) => d.toISOString().substring(0, 10); // YYYY-MM-DD

  // unique holiday date list for modifiers
  const holidayDateList = useMemo(() => {
    return [
      ...new Set(
        holidays.map((h) => {
          // ensure proper ISO format
          return h.holiday_date;
        })
      ),
    ].map((s) => new Date(s));
  }, [holidays]);

  const upcomingEvents = useMemo(() => {
    return holidays
      .map((h) => ({ ...h, dateObj: new Date(h.holiday_date) }))
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .slice(0, 10);
  }, [holidays]);

  const getUserName = (id: number | undefined | null) => {
    if (!id && id !== 0) return "Unknown";
    const u = users.find((x) => x.user_id === id);
    return u ? `${u.user_fname} ${u.user_lname}` : `User ${id}`;
  };

  // ---------------------- form / modal helpers ----------------------
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

  // ---------------------- save (create/update) ----------------------
  const handleSaveHoliday = async () => {
    try {
      const session = sessionStorage.getItem("user");
      if (!session) return toast.error("User session missing.");
      const logged = JSON.parse(session);

      if (!holidayDate || !description)
        return toast.error("Please fill all fields.");

      const payload: any = {
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

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
        {
          method: "DELETE",
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Holiday deleted successfully!");
      await loadHolidays();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete holiday.");
    }
  };

  // ---------------------- blink + scroll into view ----------------------
  // Setting blinkDateIso will add a 'blink' modifier to the calendar via modifiers prop.
  // We then wait a tick and try to scroll the element with that modifier into view.
  useEffect(() => {
    if (!blinkDateIso) return;

    // after calendar updates, find the element with the blink class and scroll to it.
    // calendarWrapRef is parent wrapper; the calendar library renders day buttons inside it.
    const timeout = setTimeout(() => {
      if (!calendarWrapRef.current) return;

      // the calendar day cells that get the modifier will have the modifier class name.
      // we assigned 'mod-blink' class in modifiersClassNames below.
      const el = calendarWrapRef.current.querySelector(".mod-blink");
      if (el && el instanceof HTMLElement) {
        // scroll into view within the calendar wrapper
        el.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      }
    }, 120); // small delay to let calendar render modifier class

    // stop blinking after 1s
    const stop = setTimeout(() => setBlinkDateIso(null), 1000);

    return () => {
      clearTimeout(timeout);
      clearTimeout(stop);
    };
  }, [blinkDateIso]);

  // when clicking upcoming event
  const onClickUpcoming = (h: Holiday) => {
    setSelectedDate(new Date(h.holiday_date));
    setBlinkDateIso(h.holiday_date);
  };

  // modifiers object for calendar
  // include blink date (if any) as array of Date
  const blinkDateList = blinkDateIso ? [new Date(blinkDateIso)] : [];

  return (
    <DashboardLayout>
      <div className="w-full">
        {/* grid: left 3/8 (span-3), right 5/8 (span-5) */}
        <div className="grid grid-cols-1 md:grid-cols-8 gap-6">
          {/* LEFT: Calendar Overview + Upcoming (span 3) */}
          <div className="col-span-1 md:col-span-3">
            <Card className="shadow-sm border rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <IconCalendar className="w-5 h-5" />
                  Calendar Overview
                </CardTitle>
              </CardHeader>

              <CardContent>
                {/* compact calendar */}
                <div
                  ref={calendarWrapRef}
                  className="w-full flex justify-center mb-3"
                  aria-hidden={false}
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
                      blink: "mod-blink", // class we will use to scroll and animate
                    }}
                  />
                </div>

                {/* upcoming events below calendar */}
                <div>
                  <h3 className="font-medium mb-2">Upcoming Events</h3>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
                    {upcomingEvents.length === 0 ? (
                      <p className="text-gray-500 text-sm">
                        No upcoming events
                      </p>
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
                            {/* small indicator dot */}
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
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Holiday Calendar Table (span 5) */}
          <div className="col-span-1 md:col-span-5">
            <Card className="shadow-sm border rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <IconCalendar className="w-5 h-5" />
                  Holiday Calendar
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-base font-semibold">List of Holidays</h2>
                  <Button
                    onClick={() => {
                      resetForm();
                      setModalOpen(true);
                    }}
                  >
                    + Add Holiday
                  </Button>
                </div>

                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        <th className="border p-2 text-left">No.</th>
                        <th className="border p-2 text-left">Date</th>
                        <th className="border p-2 text-left">Description</th>
                        <th className="border p-2 text-left">Type</th>
                        <th className="border p-2 text-left">Recurring</th>
                        <th className="border p-2 text-left">Paid</th>
                        <th className="border p-2 text-left">By</th>
                        <th className="border p-2 text-left">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {holidays.map((item, idx) => (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <td className="border p-2 align-top">{idx + 1}</td>
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
                              <div className="text-xs text-gray-400">
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
                          <td className="border p-2 align-top capitalize">
                            {item.holiday_type}
                          </td>
                          <td className="border p-2 align-top">
                            {item.is_recurring ? "Yes" : "No"}
                          </td>
                          <td className="border p-2 align-top">
                            {item.is_paid ? "Yes" : "No"}
                          </td>
                          <td className="border p-2 align-top">
                            {item.updated_by
                              ? `${getUserName(item.updated_by)} (Updated)`
                              : `${getUserName(item.created_by)} (Created)`}
                          </td>
                          <td className="border p-2 text-center flex items-center gap-2 justify-center">
                            {/* Edit Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(item)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>

                            {/* Delete Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteHoliday(item.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}

                      {holidays.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="text-center p-4 text-gray-500"
                          >
                            No holidays found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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

              <Button className="w-full" onClick={handleSaveHoliday}>
                {editingHolidayId ? "Update Holiday" : "Add Holiday"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* blink animation styles */}
        <style>{`
          @keyframes blinkPulse {
            0% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.0); }
            50% { box-shadow: 0 0 12px 6px rgba(250, 204, 21, 0.35); }
            100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.0); }
          }
          /* The calendar library will add the class 'mod-blink' to the day cell via modifiersClassNames */
          .mod-blink {
            animation: blinkPulse 1s ease-in-out;
            border-radius: 6px !important;
          }
        `}</style>
      </div>
    </DashboardLayout>
  );
}
