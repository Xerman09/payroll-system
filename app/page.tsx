import { HeroSection } from "@/components/landing/HeroSection";
import { SystemOverview } from "@/components/landing/SystemOverview";
import { CoreFeatures } from "@/components/landing/CoreFeatures";
import { RecordsReporting } from "@/components/landing/RecordsReporting";
import { UniqueFeatures } from "@/components/landing/UniqueFeatures";
import { ComparisonTable } from "@/components/landing/ComparisonTable";
import { MetricsCounters } from "@/components/landing/MetricsCounters";
import { CTAAndFooter } from "@/components/landing/CTAAndFooter";
import { SmoothScrollProvider } from "@/components/landing/SmoothScrollProvider";

export default function Home() {
  return (
    <SmoothScrollProvider>
      <main className="bg-slate-950 min-h-screen text-white selection:bg-cyan-500/30">
        <HeroSection />
        <SystemOverview />
        <CoreFeatures />
        <RecordsReporting />
        <UniqueFeatures />
        <ComparisonTable />
        <MetricsCounters />
        <CTAAndFooter />
      </main>
    </SmoothScrollProvider>
  );
}
