"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Sparkles, FileText, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface PayrollRunRecord {
  cutoff_start: string;
  cutoff_end: string;
  total_net: number;
  total_gross: number;
  status: string;
  payroll_ref_no: string;
  department_name: string;
}

export default function PayrollReportModule() {
  const [data, setData] = useState<PayrollRunRecord[]>([]);
  const [aiInsights, setAiInsights] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/reports/payroll");
        const json = await res.json();
        
        if (!res.ok) {
          throw new Error(json.error || "Failed to fetch payroll report data");
        }
        
        const fetchedData = json.data || [];
        setData(fetchedData);
        
        if (fetchedData.length === 0) {
          setAiInsights("No data available to analyze.");
        }
      } catch (err: any) {
        setError(err.message || "An unknown error occurred");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const fetchAiInsights = async (trendData: PayrollRunRecord[]) => {
    setAiLoading(true);
    try {
      const reversedData = [...trendData].reverse();
      const res = await fetch("/api/reports/payroll/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trendData: reversedData })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to fetch AI insights");
      }
      setAiInsights(json.ai_insights || "No AI insights available.");
      setHasGenerated(true);
    } catch (err: any) {
      console.error(err);
      setAiInsights(`Failed to load AI insights: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lower = searchTerm.toLowerCase();
    return data.filter(r => 
      (r.payroll_ref_no && r.payroll_ref_no.toLowerCase().includes(lower)) ||
      (r.department_name && r.department_name.toLowerCase().includes(lower)) ||
      (r.cutoff_end && r.cutoff_end.toLowerCase().includes(lower)) ||
      (r.cutoff_start && r.cutoff_start.toLowerCase().includes(lower))
    );
  }, [data, searchTerm]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-10 pt-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-primary">
          <FileText className="w-8 h-8" />
          Payroll Trend & Analytics
        </h1>
        <p className="text-muted-foreground">
          Historical overview of posted payroll runs and AI-driven insights.
        </p>
      </div>

      <Separator />

      {/* AI Analytics Section */}
      <Card className="border-primary/50 shadow-md bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2 flex flex-row justify-between items-center">
          <CardTitle className="text-xl flex items-center gap-2 text-primary">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            Executive AI Report
          </CardTitle>
          <button
            onClick={() => fetchAiInsights(data)}
            disabled={aiLoading || loading || data.length === 0}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {aiLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {aiLoading ? "Generating..." : hasGenerated ? "Regenerate Report" : "Generate Report"}
          </button>
        </CardHeader>
        <CardContent>
          {aiLoading ? (
            <div className="flex items-center gap-3 text-muted-foreground py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Analyzing payroll trends and generating executive report...</span>
            </div>
          ) : !hasGenerated ? (
            <div className="text-muted-foreground py-4 italic">
              Click &quot;Generate Report&quot; to compile a detailed AI analysis of the payroll data.
            </div>
          ) : error ? (
            <div className="text-destructive py-2">
              Failed to load analytics: {error}
            </div>
          ) : (
            <div className="max-w-none space-y-2">
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-4 mb-2 text-foreground" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-4 mb-2 text-foreground" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-3 mb-2 text-foreground" {...props} />,
                  p: ({node, ...props}) => <p className="mb-3 text-muted-foreground leading-relaxed" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 space-y-1 text-muted-foreground" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-muted-foreground" {...props} />,
                  li: ({node, ...props}) => <li className="" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                  code: ({node, ...props}) => <code className="bg-muted px-1 py-0.5 rounded text-sm text-foreground" {...props} />,
                }}
              >
                {aiInsights}
              </ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Table Section */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle>Historical Payroll Runs</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by Ref No, Dept or Date..."
                className="pl-9 bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase">
                <tr>
                  <th className="px-6 py-4 font-medium">Ref No.</th>
                  <th className="px-6 py-4 font-medium">Department</th>
                  <th className="px-6 py-4 font-medium">Cutoff Start</th>
                  <th className="px-6 py-4 font-medium">Cutoff End</th>
                  <th className="px-6 py-4 font-medium text-right">Total Gross</th>
                  <th className="px-6 py-4 font-medium text-right">Total Net</th>
                  <th className="px-6 py-4 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Fetching payroll records...
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                      No payroll records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium">{row.payroll_ref_no || "-"}</td>
                      <td className="px-6 py-4 font-medium text-primary">{row.department_name}</td>
                      <td className="px-6 py-4">{new Date(row.cutoff_start).toLocaleDateString()}</td>
                      <td className="px-6 py-4">{new Date(row.cutoff_end).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right">₱{(row.total_gross || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right font-medium">₱{(row.total_net || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-medium">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
