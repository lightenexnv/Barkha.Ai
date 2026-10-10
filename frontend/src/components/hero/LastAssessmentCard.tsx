// Translucent card showing the latest completed assessment on the hero section.
// Positioned directly under the 3D rotating model submerged in the water.
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CloudRain, Droplets, FileDown, PiggyBank } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/motion/Motion";
import { fadeUp } from "@/components/motion/presets";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatCurrency } from "@/lib/api";
import { entryVolume, useLatestImplementedAssessment } from "@/lib/historyService";
import { harvestBetween, startOfMonth, useNow } from "@/lib/liveTracking";
import type { SavedAssessment } from "@/lib/historyService";

const QuickStat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm sm:h-11 sm:w-11">
      {icon}
    </span>
    <div className="min-w-0">
      <p className="whitespace-nowrap text-xs font-normal text-white/75">{label}</p>
      <p className="whitespace-nowrap text-sm font-bold text-white sm:text-base">{value}</p>
    </div>
  </div>
);

/** Derives quick stat values from a saved assessment entry, counted from the moment it was marked implemented. */
const useQuickStats = (entry: SavedAssessment | null) => {
  const now = useNow(10_000);
  return useMemo(() => {
    if (!entry) return null;
    const volume = entryVolume(entry);
    const startDate = entry.implementedAt ? new Date(entry.implementedAt) : now;
    const monthly = entry.result?.hydrology?.monthly_harvest;
    // Seasonal monthly harvest when known; otherwise spread the year evenly
    const months = monthly?.length === 12 ? monthly : Array.from({ length: 12 }, () => volume / 12);
    const litres = Math.round(harvestBetween(months, startDate, now) * 1000);
    // Saved this month, counted only since installation (never from the 1st if installed later)
    const annualSavings = entry.result?.savings_analysis?.annual_cost_savings ?? 0;
    const savingsPerM3 = volume > 0 ? annualSavings / volume : 0;
    const monthFrom = new Date(Math.max(startDate.getTime(), startOfMonth(now).getTime()));
    const monthlySavings = Math.round(harvestBetween(months, monthFrom, now) * savingsPerM3);
    const rainfall = entry.result?.hydrology?.annual_rainfall ?? entry.site?.annual_rainfall ?? 0;
    const siteName = entry.site.site_name || "Assessment";
    return { volume, litres, monthly: monthlySavings, rainfall, siteName };
  }, [entry, now]);
};

/**
 * A sleek glass-morphism card submerged in the water under the 3D model.
 * Only rendered when the user has an assessment confirmed as implemented!
 */
export const LastAssessmentCard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const latest = useLatestImplementedAssessment(user?.id);
  const stats = useQuickStats(latest);

  if (!stats || !latest) return null;

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="relative overflow-hidden rounded-3xl border border-white/25 bg-white/10 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6"
    >
      {/* Subtle water caustics glow */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-400/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />

      {/* Header row: Site Name on left, LATEST badge on right */}
      <div className="relative mb-5 flex items-center justify-between gap-3">
        <h3 className="truncate text-base font-bold text-white tracking-tight sm:text-lg">
          {stats.siteName}
        </h3>
        <span className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
          ACTIVE
        </span>
      </div>

      {/* Stats row: 3 columns */}
      <div className="relative mb-5 grid grid-cols-3 gap-2 sm:gap-4">
        <QuickStat
          icon={<Droplets className="h-5 w-5 text-cyan-300" />}
          label="Harvested Till Now"
          value={`${stats.litres.toLocaleString("en-IN")} L`}
        />
        <QuickStat
          icon={<PiggyBank className="h-5 w-5 text-emerald-300" />}
          label="Saved This Month"
          value={formatCurrency(stats.monthly)}
        />
        <QuickStat
          icon={<CloudRain className="h-5 w-5 text-sky-300" />}
          label="Annual Rainfall"
          value={`${Math.round(stats.rainfall)} mm`}
        />
      </div>

      {/* Action row: View Results button and PDF download button */}
      <div className="relative flex items-center gap-3">
        <Pressable className="flex-1">
          <Button
            size="lg"
            variant="ghost"
            asChild
            className="h-11 w-full rounded-2xl border border-white/25 bg-white/10 text-sm font-semibold text-white shadow-sm transition hover:bg-white/20 hover:text-white sm:text-base"
          >
            <Link to={`/assess?view=${latest.id}`}>
              View Results
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </Pressable>
        <Pressable>
          <Button
            size="lg"
            variant="ghost"
            asChild
            title="Download PDF report"
            className="h-11 w-11 rounded-2xl border border-white/25 bg-white/10 p-0 text-white shadow-sm transition hover:bg-white/20 hover:text-white"
          >
            <Link to={`/assess?view=${latest.id}&download=pdf`}>
              <FileDown className="h-5 w-5" />
            </Link>
          </Button>
        </Pressable>
      </div>
    </motion.div>
  );
};
