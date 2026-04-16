"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { User, Shield, Briefcase, ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { ProfileHeader } from "./components/ProfileHeader";
import { PersonalInfoForm } from "./components/PersonalInfoForm";
import { SecuritySettings } from "./components/SecuritySettings";
import { EmploymentInfo } from "./components/EmploymentInfo";
import { fetchUserProfile, fetchDepartments } from "./providers/profileApi";
import { Loader2 } from "lucide-react";
import { getLoggedUser } from "@/lib/auth";

interface ProfileModuleProps {
  userId: string | number;
}

export function ProfileModule({ userId }: ProfileModuleProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let activeId = userId;
      
      // Resolve "me" to the actual logged-in user ID using the token in sessionStorage
      if (userId === "me") {
        const loggedUser = getLoggedUser();
        if (loggedUser?.user_id) {
          activeId = loggedUser.user_id;
        } else {
          throw new Error("User not authenticated");
        }
      }

      const [data, departments] = await Promise.all([
        fetchUserProfile(activeId),
        fetchDepartments()
      ]);

      // If user_department is a number, resolve it to the full object
      if (data && typeof data.user_department === "number" && departments.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dept = departments.find((d: any) => d.department_id === data.user_department);
        if (dept) {
          data.user_department = dept;
        }
      }

      setUser(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load profile data.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Loading Profile...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="text-center p-12 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 max-w-md mx-auto">
        <p className="text-red-600 font-bold">{error || "User not found"}</p>
        <Link href="/dashboard/me" className="mt-4 text-primary font-bold underline">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Breadcrumbs & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400">
          <Link href="/dashboard/me" className="hover:text-primary transition-colors flex items-center gap-1">
            <Home size={12} /> Dashboard
          </Link>
          <ChevronRight size={12} />
          <span className="text-gray-900 dark:text-gray-100">My Profile</span>
        </nav>

        <Link href="/dashboard/me">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-bold uppercase tracking-widest transition-all active:scale-95 border border-gray-200 dark:border-gray-700">
            <ChevronRight size={14} className="rotate-180" />
            Return to Dashboard
          </button>
        </Link>
      </div>

      <Card className="border-none shadow-2xl bg-white/70 dark:bg-gray-900/70 backdrop-blur rounded-xl overflow-hidden">
        <CardContent className="p-8 md:p-12">
          <ProfileHeader user={user} onRefresh={loadData} />

          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="bg-gray-100/50 dark:bg-gray-800/50 p-1 mb-10 h-auto grid grid-cols-3 md:inline-flex rounded-lg border border-gray-200 dark:border-gray-700">
              <TabsTrigger 
                value="personal" 
                className="rounded-lg px-6 py-3 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow-lg data-[state=active]:text-primary font-bold transition-all gap-2"
              >
                <User size={16} /> <span className="hidden sm:inline">Personal Information</span>
              </TabsTrigger>
              <TabsTrigger 
                value="employment" 
                className="rounded-lg px-6 py-3 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow-lg data-[state=active]:text-primary font-bold transition-all gap-2"
              >
                <Briefcase size={16} /> <span className="hidden sm:inline">Employment</span>
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="rounded-lg px-6 py-3 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow-lg data-[state=active]:text-amber-600 font-bold transition-all gap-2"
              >
                <Shield size={16} /> <span className="hidden sm:inline">Security</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <PersonalInfoForm user={user} onRefresh={loadData} />
            </TabsContent>
            
            <TabsContent value="employment" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <EmploymentInfo user={user} />
            </TabsContent>

            <TabsContent value="security" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <SecuritySettings user={user} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
