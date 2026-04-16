"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Plus, Printer, RefreshCw, RotateCcw, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import SavingsTab from "./components/SavingsTab";
import LoansTab from "./components/LoansTab";
import { useRef } from "react";
import { PrintPreviewModal } from "./components/modals/PrintPreviewModal";

export function CoopManagementModule() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams?.get("tab");
    if (tabParam && (tabParam === "savings" || tabParam === "loans")) {
      return tabParam;
    }
    return "savings";
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [printData, setPrintData] = useState<Record<string, unknown>[]>([]);

  const savingsRef = useRef<{ getData: () => Record<string, unknown>[] }>(null);
  const loansRef = useRef<{ getData: () => Record<string, unknown>[] }>(null);

  // Synchronize activeTab with URL 'tab' parameter
  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    if (tabParam && (tabParam === "savings" || tabParam === "loans")) {
      if (tabParam !== activeTab) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveTab(tabParam);
      }
    }
  }, [searchParams, activeTab]);

  const handleRefresh = () => setRefreshTrigger((prev) => prev + 1);

  const handleReset = () => {
    setSearchTerm("");
    setStatusFilter("All");
    toast.info("Filters reset");
  };

  const handlePrint = () => {
    const data = activeTab === "savings" 
      ? savingsRef.current?.getData() 
      : loansRef.current?.getData();
    
    if (!data || data.length === 0) {
      toast.error("No data available to print.");
      return;
    }
    
    setPrintData(data as Record<string, unknown>[]);
    setIsPreviewOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              COOP Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === "savings"
                ? "Manage employee savings records and collections."
                : "Track employee loans, payments, and balances."}
            </p>
          </div>

          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            {activeTab === "savings" ? "Add Employee" : "Add Loan"}
          </Button>
        </div>

        <Separator />

        <Card className="shadow-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-5 space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Search employee
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="md:col-span-3 space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Processed / Status
                </Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>

                    {activeTab === "loans" && <SelectItem value="PAID">Paid</SelectItem>}
                    {activeTab === "loans" && (
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    )}

                    {activeTab === "savings" && (
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-4 space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Quick Actions
                </Label>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleReset}>
                    <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reset
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-primary/20 text-primary hover:bg-primary/5"
                    onClick={handlePrint}
                  >
                    <Printer className="h-3.5 w-3.5 mr-2" /> Print
                  </Button>
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={handleRefresh}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-2" /> Refresh
                  </Button>
                </div>
              </div>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(val) => {
                setActiveTab(val);
                handleReset();
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="savings">Savings Management</TabsTrigger>
                <TabsTrigger value="loans">Loans Management</TabsTrigger>
              </TabsList>

              <TabsContent value="savings" className="mt-0 space-y-4">
                <SavingsTab
                  ref={savingsRef}
                  searchTerm={searchTerm}
                  statusFilter={statusFilter}
                  refreshTrigger={refreshTrigger}
                  isAddModalOpen={isAddModalOpen && activeTab === "savings"}
                  onCloseAddModal={() => setIsAddModalOpen(false)}
                />
              </TabsContent>

              <TabsContent value="loans" className="mt-0 space-y-4">
                <LoansTab
                  ref={loansRef}
                  searchTerm={searchTerm}
                  statusFilter={statusFilter}
                  refreshTrigger={refreshTrigger}
                  isAddModalOpen={isAddModalOpen && activeTab === "loans"}
                  onCloseAddModal={() => setIsAddModalOpen(false)}
                />
              </TabsContent>
            </Tabs>

            <PrintPreviewModal
              isOpen={isPreviewOpen}
              onClose={() => setIsPreviewOpen(false)}
              type={activeTab as "savings" | "loans"}
              data={printData}
              searchTerm={searchTerm}
              statusFilter={statusFilter}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
