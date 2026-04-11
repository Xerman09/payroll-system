"use client";

import React from "react";
import { IdCard, Briefcase, Calendar, Fingerprint, Nfc } from "lucide-react";

interface EmploymentInfoProps {
  user: any;
}

export function EmploymentInfo({ user }: EmploymentInfoProps) {
  const DataRow = ({ icon: Icon, label, value, colorClass }: { icon: any; label: string; value: string; colorClass: string }) => (
    <div className="flex items-start gap-4 p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-gray-100 dark:border-gray-700/50">
      <div className={`h-10 w-10 ${colorClass} rounded-lg flex items-center justify-center shrink-0 shadow-sm`}>
        <Icon size={20} />
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">{label}</p>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{value || "N/A"}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-indigo-600">
        <Briefcase size={18} />
        <h3 className="font-bold uppercase tracking-wider text-sm">Employment Details</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DataRow 
          icon={IdCard} 
          label="Employee ID" 
          value={user?.user_id?.toString()} 
          colorClass="bg-blue-50 dark:bg-blue-900/20 text-blue-600" 
        />
        <DataRow 
          icon={Briefcase} 
          label="Position" 
          value={user?.user_position} 
          colorClass="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" 
        />
        <DataRow 
          icon={Calendar} 
          label="Date of Hire" 
          value={user?.user_dateOfHire ? new Date(user.user_dateOfHire).toLocaleDateString() : "N/A"} 
          colorClass="bg-amber-50 dark:bg-amber-900/20 text-amber-600" 
        />
        <DataRow 
          icon={Fingerprint} 
          label="Biometric ID" 
          value={user?.biometric_id} 
          colorClass="bg-purple-50 dark:bg-purple-900/20 text-purple-600" 
        />
        <DataRow 
          icon={Nfc} 
          label="RFID" 
          value={user?.rf_id} 
          colorClass="bg-rose-50 dark:bg-rose-900/20 text-rose-600" 
        />
        <DataRow 
          icon={Briefcase} 
          label="Employment Tags" 
          value={user?.user_tags} 
          colorClass="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600" 
        />
      </div>

      <div className="p-4 bg-blue-50/20 dark:bg-blue-900/10 rounded-lg border border-blue-100/50 dark:border-blue-800/20">
        <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 italic">
          * Employment details are read-only. Please contact HR if any information is incorrect.
        </p>
      </div>
    </div>
  );
}
