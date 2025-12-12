// @modules/wage/components/WageModal.tsx
"use client";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { Employee, WageDataState } from "../types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEmployee: Employee | null;
  wageData: WageDataState;
  setWageData: (upd: Partial<WageDataState>) => void;
  onSave: () => Promise<void> | void;
};

export default function WageModal({
  open,
  onOpenChange,
  selectedEmployee,
  wageData,
  setWageData,
  onSave,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl w-full max-h-[80vh] p-6 rounded-md shadow-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            Wage Information —{" "}
            {selectedEmployee
              ? `${selectedEmployee.user_fname} ${selectedEmployee.user_lname}`
              : "Unknown Employee"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {" "}
              Employee ID{" "}
            </label>
            <Input
              type="text"
              value={selectedEmployee?.user_id || ""}
              disabled
              className="w-full rounded-md focus:outline-none focus:ring-0"
            />
          </div>

          <div className="flex flex-col relative">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {" "}
              Daily Wage{" "}
            </label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                {" "}
                ₱{" "}
              </span>
              <Input
                type="text"
                value={wageData.dailyWageInput}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*\.?\d*$/.test(value)) {
                    setWageData({
                      dailyWageInput: value,
                      dailyWage: Number(value) || 0,
                    });
                  }
                }}
                onBlur={() => {
                  setWageData({
                    dailyWageInput: wageData.dailyWage.toFixed(2),
                  });
                }}
                className="w-full rounded-md pl-6 focus:outline-none focus:ring-0"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {" "}
              Vacation Leave{" "}
            </label>
            <Input
              type="number"
              value={wageData.vacationLeave}
              onChange={(e) =>
                setWageData({ vacationLeave: Number(e.target.value) })
              }
              className="w-full rounded-md focus:outline-none focus:ring-0"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {" "}
              Sick Leave{" "}
            </label>
            <Input
              type="number"
              value={wageData.sickLeave}
              onChange={(e) =>
                setWageData({ sickLeave: Number(e.target.value) })
              }
              className="w-full rounded-md focus:outline-none focus:ring-0"
            />
          </div>

          <div className="flex items-center gap-2 col-span-2">
            <Checkbox
              checked={wageData.isPaidHoliday}
              onCheckedChange={(checked) =>
                setWageData({ isPaidHoliday: !!checked })
              }
            />
            <label className="text-sm text-gray-700 dark:text-gray-200">
              {" "}
              Paid Holiday{" "}
            </label>
          </div>

          <div className="col-span-2 border-t border-gray-300 dark:border-gray-600 mt-2 mb-1"></div>

          <div className="col-span-2">
            <div className="text-m font-medium text-gray-700 dark:text-gray-200 mb-2">
              {" "}
              Benefits{" "}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(["SSS", "Pagibig", "Philhealth"] as const).map((field) => {
                const key = field.toLowerCase() as
                  | "sss"
                  | "pagibig"
                  | "philhealth";
                return (
                  <div key={field} className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      {" "}
                      {field}{" "}
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                        {" "}
                        ₱{" "}
                      </span>
                      <Input
                        type="text"
                        value={wageData[key]}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (/^\d*\.?\d*$/.test(value)) {
                            setWageData({ [key]: value } as Partial<
                              typeof wageData
                            >);
                          }
                        }}
                        onBlur={() => {
                          const v =
                            wageData[key] === ""
                              ? "0.00"
                              : parseFloat(wageData[key]).toFixed(2);
                          setWageData({ [key]: v } as Partial<typeof wageData>);
                        }}
                        className="w-full rounded-md pl-6 py-2 focus:outline-none focus:ring-0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {" "}
            Last Updated By: {wageData.lastUpdatedBy} on{" "}
            {wageData.lastUpdateDate}{" "}
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-persian-blue-800 hover:bg-persian-blue-700 text-white rounded-md px-6 py-2"
              onClick={onSave}
            >
              {" "}
              Save{" "}
            </Button>
            <Button
              variant="outline"
              className="rounded-md px-6 py-2"
              onClick={() => onOpenChange(false)}
            >
              {" "}
              Cancel{" "}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
