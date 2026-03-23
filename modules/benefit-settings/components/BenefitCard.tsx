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

export default function BenefitCard({
  name,
  code,
  setting,
  getUserName,
  onCutoff,
}: {
  name: string;
  code: BenefitCode;
  setting: BenefitSetting | null;
  getUserName: (id: number | null) => string;
  onCutoff: (c: BenefitCode, newValue: BenefitSetting["cutoff"]) => void;
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

      <CardContent className="flex-1 space-y-6 py-5">
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
              {s.updated_date
                ? new Date(s.updated_date).toLocaleDateString()
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
  );
}
