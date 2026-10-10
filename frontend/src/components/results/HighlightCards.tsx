import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Droplets, ExternalLink, PiggyBank } from "lucide-react";
import { InfoTip } from "@/components/InfoTip";
import { fadeUp, stagger } from "@/components/motion/presets";
import { useLanguage } from "@/context/LanguageContext";
import { formatCurrency, type AssessmentResult, type SiteDetailsInput } from "@/lib/api";
import { tankersPerYear } from "@/lib/saral";
import { cn } from "@/lib/utils";
import { MonthlyReportModal } from "./MonthlyReportModal";
import type { MonthlyRecord, MonthlyReportData } from "@/lib/monthlyReportGenerator";

interface HighlightCardsProps {
  harvestM3: number;
  monthlySavings: number;
  annualSavings: number;
  waterUsedM3: number;
  tariff: number;
  /** Years, or null when there are no bill savings */
  paybackYears: number | null;
  /** Payback using the cost after the selected subsidy, when one is applied */
  paybackAfterSubsidy: number | null;
  /** Whether this system has been confirmed as implemented */
  isImplemented?: boolean;
  /** ISO timestamp when system was marked as implemented */
  implementedAt?: string;
  site?: Partial<SiteDetailsInput>;
  result?: Partial<AssessmentResult>;
  totalCost?: number;
  subsidyAmount?: number;
}

const Card = ({
  gradient,
  icon,
  label,
  value,
  sub,
  tip,
  tag,
  onClick,
  className,
}: {
  gradient: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tip: string;
  /** Small pill next to the label, e.g. "with subsidy" */
  tag?: string | null;
  onClick?: () => void;
  className?: string;
}) => (
  <motion.div
    variants={fadeUp}
    whileHover={{ y: -4 }}
    transition={{ type: "spring", stiffness: 300, damping: 22 }}
    onClick={onClick}
    className={cn(
      "relative overflow-hidden rounded-2xl p-5 text-white shadow-lg",
      gradient,
      onClick && "cursor-pointer hover:shadow-2xl hover:ring-2 hover:ring-white/40 active:scale-[0.99] transition-all",
      className,
    )}
  >
    <div aria-hidden="true" className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 blur-sm" />
    <div className="relative flex items-start justify-between gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">{icon}</span>
      <InfoTip className="text-white/80 hover:bg-white/20 hover:text-white">{tip}</InfoTip>
    </div>
    <p className="relative mt-4 flex flex-wrap items-center gap-2 text-sm font-medium text-white/85">
      {label}
      <AnimatePresence>
        {tag && (
          <motion.span
            key={tag}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/40 backdrop-blur-sm"
          >
            {tag}
          </motion.span>
        )}
      </AnimatePresence>
    </p>
    <motion.p
      key={value}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="relative text-3xl font-extrabold tracking-tight tabular-nums"
    >
      {value}
    </motion.p>
    <p className="relative mt-1 text-sm text-white/85">{sub}</p>
  </motion.div>
);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Three headline cards:
 * - When planned: shows projected potential numbers.
 * - When implemented: dynamically tracks water harvested till now, savings this month, and remaining payback timeline.
 */
export const HighlightCards = ({
  harvestM3,
  monthlySavings,
  annualSavings,
  waterUsedM3,
  tariff,
  paybackYears,
  paybackAfterSubsidy,
  isImplemented,
  implementedAt,
  site = {},
  result = {},
  totalCost = 0,
  subsidyAmount = 0,
}: HighlightCardsProps) => {
  const { t, locale } = useLanguage();
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Dynamic calculations from implementation date
  const dynamicStats = useMemo(() => {
    if (!isImplemented) return null;

    const startDate = implementedAt ? new Date(implementedAt) : new Date();
    const now = new Date();
    const daysSinceImplemented = Math.max(1, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    const monthlyRainfall = result.hydrology?.monthly_rainfall || site.monthly_rainfall || [15, 20, 25, 40, 80, 160, 280, 240, 120, 35, 15, 10];
    const totalRainMm = monthlyRainfall.reduce((a, b) => a + b, 0) || 800;

    // Monthly harvest in m3
    const monthlyHarvest = result.hydrology?.monthly_harvest?.length === 12
      ? result.hydrology.monthly_harvest
      : monthlyRainfall.map((r) => (r / totalRainMm) * harvestM3);

    const currentMonthIndex = now.getMonth();
    const startMonthIndex = startDate.getMonth();
    const dayRatio = Math.min(1, Math.max(0.1, now.getDate() / 30));

    let cumulativeSavings = 0;
    const records: MonthlyRecord[] = [];

    // Build 12-month records
    for (let i = 0; i < 12; i++) {
      const isPastOrCurrent = (i <= currentMonthIndex && i >= startMonthIndex) || (startMonthIndex > currentMonthIndex && (i >= startMonthIndex || i <= currentMonthIndex));
      const mHarvest = monthlyHarvest[i];
      const mSavings = Math.round(mHarvest * tariff);
      cumulativeSavings += mSavings;

      records.push({
        monthIndex: i,
        monthName: MONTH_NAMES[i],
        rainMm: monthlyRainfall[i] || 0,
        harvestM3: mHarvest,
        harvestLitres: Math.round(mHarvest * 1000),
        savings: mSavings,
        cumulativeSavings,
        status: isPastOrCurrent ? "Actual" : "Projected",
      });
    }

    // Water harvested till now calculation:
    // Prorate by days elapsed or monthly progression
    const monthsElapsed = Math.max(0.2, (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4));
    const annualProportion = Math.min(1, Math.max(0.02, daysSinceImplemented / 365));
    const harvestedTillNowM3 = Math.max(0.5, harvestM3 * annualProportion);
    const harvestedTillNowLitres = Math.round(harvestedTillNowM3 * 1000);

    // Savings this month
    const curMonthHarvest = monthlyHarvest[currentMonthIndex] || (harvestM3 / 12);
    const savedThisMonth = Math.round(curMonthHarvest * tariff * dayRatio);
    const totalSavingsTillNow = Math.round(harvestedTillNowM3 * tariff);

    // Remaining payback
    const netCost = Math.max(0, totalCost - subsidyAmount);
    const remainingCost = Math.max(0, netCost - totalSavingsTillNow);
    const remainingYears = annualSavings > 0 ? remainingCost / annualSavings : null;

    const reportData: MonthlyReportData = {
      site,
      result,
      implementedAt: implementedAt || startDate.toISOString(),
      records,
      totalHarvestM3: harvestedTillNowM3,
      totalHarvestLitres: harvestedTillNowLitres,
      totalSavings: totalSavingsTillNow,
      monthlySavings: savedThisMonth,
      remainingPaybackYears: remainingYears,
      netCost,
    };

    return {
      daysSinceImplemented,
      harvestedTillNowM3,
      harvestedTillNowLitres,
      savedThisMonth,
      totalSavingsTillNow,
      remainingCost,
      netCost,
      remainingYears,
      startDate,
      reportData,
    };
  }, [isImplemented, implementedAt, harvestM3, tariff, totalCost, subsidyAmount, annualSavings, result, site]);

  // Standard planning mode calculations
  const litres = Math.round(harvestM3 * 1000).toLocaleString(locale);
  const subsidised = paybackYears !== null && paybackAfterSubsidy !== null && paybackAfterSubsidy < paybackYears;
  const effectivePayback = subsidised ? paybackAfterSubsidy : paybackYears;
  const years = (value: number) => (value < 1 ? t("highlight.underAYear") : t("result.years", { count: value.toFixed(1) }));

  if (isImplemented && dynamicStats) {
    return (
      <>
        <motion.div initial="hidden" animate="show" variants={stagger(0.1)} className="grid gap-4 md:grid-cols-3">
          {/* 1. Water harvested till now */}
          <Card
            gradient="bg-gradient-to-br from-sky-500 via-blue-600 to-blue-800"
            icon={<Droplets className="h-6 w-6 text-cyan-200" />}
            label="Water harvested till now"
            value={`${dynamicStats.harvestedTillNowLitres.toLocaleString(locale)} L`}
            sub={`Active for ${dynamicStats.daysSinceImplemented} days (${dynamicStats.harvestedTillNowM3.toFixed(1)} m³)`}
            tip={`Calculated from the day your system was marked implemented (${dynamicStats.startDate.toLocaleDateString(locale)}).`}
            tag="Live Tracking"
          />

          {/* 2. Money saved this month (clickable to open monthly report dialog) */}
          <Card
            gradient="bg-gradient-to-br from-emerald-500 via-teal-600 to-teal-800"
            icon={<PiggyBank className="h-6 w-6 text-emerald-200" />}
            label="Money saved this month"
            value={formatCurrency(dynamicStats.savedThisMonth)}
            sub={`Total ${formatCurrency(dynamicStats.totalSavingsTillNow)} saved · Click for monthly report ↗`}
            tip="Click to view full month-by-month harvest statement and download PDF report."
            tag="Click to View"
            onClick={() => setReportModalOpen(true)}
          />

          {/* 3. To be paid in __ years (optimal heading: Paid off in) */}
          <Card
            gradient="bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-700"
            icon={<CalendarClock className="h-6 w-6 text-teal-200" />}
            label="Paid off in"
            value={dynamicStats.remainingYears !== null ? `${dynamicStats.remainingYears.toFixed(1)} years` : "N/A"}
            sub={`₹${Math.round(dynamicStats.remainingCost).toLocaleString(locale)} remaining of ${formatCurrency(dynamicStats.netCost)} cost`}
            tip="Estimated remaining time to break even based on initial investment minus cumulative savings."
            tag={subsidyAmount > 0 ? "with subsidy" : "ROI on track"}
          />
        </motion.div>

        {/* Monthly report statement modal */}
        <MonthlyReportModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          data={dynamicStats.reportData}
        />
      </>
    );
  }

  // Fallback: Default projected numbers when not yet implemented
  return (
    <motion.div initial="hidden" animate="show" variants={stagger(0.1)} className="grid gap-4 md:grid-cols-3">
      <Card
        gradient="bg-gradient-to-br from-sky-500 via-blue-600 to-blue-800"
        icon={<Droplets className="h-6 w-6" />}
        label={t("highlight.harvest")}
        value={`${harvestM3.toLocaleString(locale, { maximumFractionDigits: 1 })} m³`}
        sub={t("highlight.harvestSub", { litres, tankers: tankersPerYear(harvestM3) })}
        tip={t("highlight.harvestTip")}
      />
      <Card
        gradient="bg-gradient-to-br from-emerald-500 via-teal-600 to-teal-800"
        icon={<PiggyBank className="h-6 w-6" />}
        label={t("highlight.monthly")}
        value={formatCurrency(monthlySavings)}
        sub={monthlySavings > 0 ? t("highlight.monthlySub", { yearly: formatCurrency(annualSavings) }) : t("highlight.noSavings")}
        tip={t("highlight.monthlyTip", {
          used: Math.round(waterUsedM3 * 1000).toLocaleString(locale),
          tariff,
        })}
      />
      <Card
        gradient="bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-700"
        icon={<CalendarClock className="h-6 w-6" />}
        label={t("highlight.payback")}
        value={effectivePayback === null ? t("highlight.notApplicable") : years(effectivePayback)}
        sub={
          paybackYears === null
            ? t("highlight.noSavings")
            : subsidised
              ? t("highlight.beforeSubsidy", { years: years(paybackYears) })
              : t("highlight.paybackSub")
        }
        tip={t(subsidised ? "highlight.paybackTipSubsidy" : "highlight.paybackTip")}
        tag={subsidised ? t("highlight.withSubsidy") : null}
      />
    </motion.div>
  );
};
