// modules/lgu-payroll-run/components/LguPayrollProcessStep.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Cpu, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface LguPayrollProcessStepProps {
  onComplete: () => void;
  activeCount: number;
}

export default function LguPayrollProcessStep({
  onComplete,
  activeCount,
}: LguPayrollProcessStepProps) {
  const [progress, setProgress] = useState(15);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setProgress(45), 350);
    const timer2 = setTimeout(() => setProgress(80), 750);
    const timer3 = setTimeout(() => {
      setProgress(100);
      setDone(true);
    }, 1100);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <Card className="max-w-xl mx-auto border-slate-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900 py-10">
      <CardContent className="flex flex-col items-center justify-center text-center space-y-5">
        <div className={`p-4 rounded-full ${done ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600 animate-pulse"}`}>
          {done ? <CheckCircle2 className="h-10 w-10" /> : <Cpu className="h-10 w-10 animate-spin" />}
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-gray-100">
            {done ? "Matagumpay na Naproseso ang Talaan!" : "Pinoproseso ang LGU Payroll Records..."}
          </h3>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            {done
              ? `Handa na ang ${activeCount} talaan para sa pinal na pagsusuri at LGU Top Sheet.`
              : `Kina-calculate ang GSIS, PhilHealth, Pag-IBIG LGU counterpart at PERA allowances para sa ${activeCount} kawani.`}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-sm bg-slate-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        {done && (
          <Button
            onClick={onComplete}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-6 h-9 flex items-center gap-1.5"
          >
            <span>Pumunta sa Pagsusuri &amp; Top Sheet</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
