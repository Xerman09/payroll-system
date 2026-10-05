"use client";

import { BenefitCode, BenefitSetting } from "../types";
import BenefitCutoff from "./BenefitCutoff";
import BenefitDates from "./BenefitDates";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

import { format, parseISO } from "date-fns";
import { formatMoney } from "../providers/benefitApi";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

function formatDateSafe(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = typeof dateStr === "string" && dateStr.includes("T") ? parseISO(dateStr) : new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return format(d, "MMM dd, yyyy");
  } catch {
    return String(dateStr);
  }
}

export default function BenefitCard({
  name,
  code,
  setting,
  getUserName,
  onCutoff,
  enrolledCount,
  totalMonthlyAmount,
  onViewEmployees,
}: {
  name: string;
  code: BenefitCode;
  setting: BenefitSetting | null;
  getUserName: (id: number | null) => string;
  onCutoff: (c: BenefitCode, newValue: BenefitSetting["cutoff"]) => void;
  enrolledCount?: number;
  totalMonthlyAmount?: number;
  onViewEmployees?: (c: BenefitCode) => void;
}) {
  const s = setting;

  return (
    <Card className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow duration-200 dark:bg-gray-900 dark:border-gray-800">
      <CardHeader className="pb-3 bg-muted/30 dark:bg-gray-800/50">
        <div className="flex justify-between items-start">
          <CardTitle className="text-base font-semibold leading-tight">
            {name}
          </CardTitle>
          <Badge
            variant="outline"
            className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground"
          >
            {code}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-5 py-4">
        {/* Enrolled Employee Quick Bar */}
        {onViewEmployees && (
          <div className="rounded-lg bg-slate-50 dark:bg-gray-800/60 p-2.5 border border-slate-200/80 dark:border-gray-700/80 flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>{enrolledCount ?? 0} Enrolled</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-gray-400">
                ₱{formatMoney(totalMonthlyAmount ?? 0)} / mo
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2.5 font-medium dark:border-gray-700 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
              onClick={() => onViewEmployees(code)}
            >
              View List
            </Button>
          </div>
        )}

        <BenefitCutoff
          code={code}
          current={s?.cutoff || null}
          onChange={(v) => onCutoff(code, v)}
        />

        {s && (
          <BenefitDates
             value={s}
          />
        )}
      </CardContent>

      {/* Footer for Metadata */}
      <CardFooter className="pt-3 pb-3 bg-muted/10 dark:bg-gray-800/30 border-t dark:border-gray-800 min-h-[3rem]">
        {s && s.updated_by ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
            <User className="h-3 w-3" />
            <span className="truncate">
              Updated by{" "}
              <span className="font-medium text-foreground dark:text-gray-200">
                {getUserName(s.updated_by)}
              </span>
            </span>
            <span className="ml-auto opacity-70">
              {formatDateSafe(s.updated_date)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">
            No update history
          </span>
        )}
      </CardFooter>
    </Card>
  );
}

