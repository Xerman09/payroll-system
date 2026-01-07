// modules/cutoff-settings/components/CutoffSettingsTable.tsx
"use client";

import type { CutoffSettingRow } from "../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pencil, User } from "lucide-react";

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  // If it's already YYYY-MM-DD, keep it consistent and simple.
  // You can switch to locale formatting anytime.
  return v;
}

function cutoffTitle(type: CutoffSettingRow["cutoff_type"]) {
  return type === "FIRST" ? "1st Cutoff" : "2nd Cutoff";
}

export default function CutoffSettingsTable({
  first,
  second,
  onEdit,
  getUserName,
}: {
  first: CutoffSettingRow | null;
  second: CutoffSettingRow | null;
  onEdit: (row: CutoffSettingRow) => void;
  getUserName: (id: string | number | null | undefined) => string;
}) {
  const rows = [first, second].filter(Boolean) as CutoffSettingRow[];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {rows.map((row) => (
        <Card
          key={row.cutoff_type}
          className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          <CardHeader className="pb-3 bg-muted/30">
            <div className="flex justify-between items-start gap-3">
              <div>
                <CardTitle className="text-base font-semibold leading-tight">
                  {cutoffTitle(row.cutoff_type)}
                </CardTitle>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDate(row.start_date)} → {formatDate(row.end_date)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground"
                >
                  {row.cutoff_type}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => onEdit(row)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-4 py-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Start Date</div>
                <div className="font-medium">{formatDate(row.start_date)}</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">End Date</div>
                <div className="font-medium">{formatDate(row.end_date)}</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Payout Date</div>
                <div className="font-medium">{formatDate(row.payout_date)}</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  Period Status
                </div>
                <div className="font-medium">{row.period_status ?? "—"}</div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-3 pb-3 bg-muted/10 border-t min-h-[3rem]">
            {row.updated_by ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
                <User className="h-3 w-3" />
                <span className="truncate">
                  Updated by{" "}
                  <span className="font-medium text-foreground">
                    {getUserName(row.updated_by)}
                  </span>
                </span>
                <span className="ml-auto opacity-70">
                  {row.date_updated
                    ? new Date(row.date_updated).toLocaleDateString()
                    : ""}
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                No update history
              </span>
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
