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
import { elapsedParts, harvestBetween, startOfMonth, useNow } from "@/lib/liveTracking";
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

/** Three live counters (collected / used at home / sent into the ground) since installation. */
const LiveFlow = ({
  collectedM3,
  usedM3,
  groundM3,
  hasRecharge,
  sinceLabel,
}: {
  collectedM3: number;
  usedM3: number;
  groundM3: number;
  hasRecharge: boolean;
  sinceLabel: string;
}) => {
  const { t, locale } = useLanguage();
  // One decimal while small, so the counters visibly move in light rain too
  const litres = (m3: number) => {
    const value = m3 * 1000;
    return `${value.toLocaleString(locale, { maximumFractionDigits: value < 1000 ? 1 : 0, minimumFractionDigits: value < 1000 ? 1 : 0 })} L`;
  };
  const tiles = [
    { label: t("flow.collected"), value: collectedM3, tone: "bg-blue-600/10 text-blue-700 dark:text-blue-300" },
    { label: t("flow.used"), value: usedM3, tone: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300" },
    { label: t(hasRecharge ? "flow.ground" : "flow.overflow"), value: groundM3, tone: "bg-teal-600/10 text-teal-700 dark:text-teal-300" },
  ];
  return (
    <motion.section variants={fadeUp} initial="hidden" animate="show" aria-label={t("flow.title")} className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          {t("flow.title")}
        </h3>
        <span className="text-xs text-muted-foreground">{sinceLabel}</span>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className={cn("rounded-xl p-3", tile.tone)}>
            <dt className="text-xs font-medium opacity-80">{tile.label}</dt>
            <dd className="text-xl font-extrabold tabular-nums">{litres(tile.value)}</dd>
          </div>
        ))}
      </dl>
    </motion.section>
  );
};

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

  // Live figures count from the exact moment the system was marked implemented
  const now = useNow(2_000);
  const dynamicStats = useMemo(() => {
    if (!isImplemented) return null;

    const startDate = implementedAt ? new Date(implementedAt) : now;
    const monthlyRainfall = result.hydrology?.monthly_rainfall || site.monthly_rainfall || [15, 20, 25, 40, 80, 160, 280, 240, 120, 35, 15, 10];
    const totalRainMm = monthlyRainfall.reduce((a, b) => a + b, 0) || 800;
    const monthlyHarvest = result.hydrology?.monthly_harvest?.length === 12
      ? result.hydrology.monthly_harvest
      : monthlyRainfall.map((r) => (r / totalRainMm) * harvestM3);
    // Rupees saved per m³ collected (only the share the site actually uses is a saving)
    const savingsPerM3 = harvestM3 > 0 ? annualSavings / harvestM3 : 0;

    const harvestedTillNowM3 = harvestBetween(monthlyHarvest, startDate, now);
    const harvestedTillNowLitres = Math.round(harvestedTillNowM3 * 1000);
    const totalSavingsTillNow = harvestedTillNowM3 * savingsPerM3;
    const thisMonthFrom = new Date(Math.max(startDate.getTime(), startOfMonth(now).getTime()));
    const savedThisMonth = harvestBetween(monthlyHarvest, thisMonthFrom, now) * savingsPerM3;

    const netCost = Math.max(0, totalCost - subsidyAmount);
    const remainingCost = Math.max(0, netCost - totalSavingsTillNow);
    const remainingYears = annualSavings > 0 ? remainingCost / annualSavings : null;

    // Twelve months from the installation month: elapsed time is "Actual",
    // the rest of each month (and later months) is "Projected"
    let cumulativeSavings = 0;
    const records: MonthlyRecord[] = Array.from({ length: 12 }, (_, k) => {
      const begin = new Date(startDate.getFullYear(), startDate.getMonth() + k, 1);
      const finish = new Date(startDate.getFullYear(), startDate.getMonth() + k + 1, 1);
      const from = new Date(Math.max(begin.getTime(), startDate.getTime()));
      const elapsed = begin < now;
      const mHarvest = harvestBetween(monthlyHarvest, from, elapsed ? new Date(Math.min(now.getTime(), finish.getTime())) : finish);
      const mSavings = Math.round(mHarvest * savingsPerM3);
      cumulativeSavings += mSavings;
      return {
        monthIndex: begin.getMonth(),
        monthName: MONTH_NAMES[begin.getMonth()],
        rainMm: monthlyRainfall[begin.getMonth()] || 0,
        harvestM3: mHarvest,
        harvestLitres: Math.round(mHarvest * 1000),
        savings: mSavings,
        cumulativeSavings,
        status: elapsed ? "Actual" : "Projected",
      };
    });

    const reportData: MonthlyReportData = {
      site,
      result,
      implementedAt: startDate.toISOString(),
      records,
      totalHarvestM3: harvestedTillNowM3,
      totalHarvestLitres: harvestedTillNowLitres,
      totalSavings: Math.round(totalSavingsTillNow),
      monthlySavings: Math.round(savedThisMonth),
      remainingPaybackYears: remainingYears,
      netCost,
    };

    // Where the collected rain went: used at home up to the share the site
    // uses; the rest goes to the recharge pit (or overflows if there is none)
    const usedShare = harvestM3 > 0 ? Math.min(1, waterUsedM3 / harvestM3) : 0;
    const usedM3 = harvestedTillNowM3 * usedShare;
    const groundM3 = harvestedTillNowM3 - usedM3;

    return {
      usedM3,
      groundM3,
      elapsed: elapsedParts(startDate, now),
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
  }, [isImplemented, implementedAt, now, harvestM3, waterUsedM3, totalCost, subsidyAmount, annualSavings, result, site]);

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
            gradient="bg-blue-600"
            icon={<Droplets className="h-6 w-6 text-cyan-200" />}
            label="Water harvested till now"
            value={`${dynamicStats.harvestedTillNowLitres.toLocaleString(locale)} L`}
            sub={`${t(`live.since.${dynamicStats.elapsed.unit}`, { count: dynamicStats.elapsed.value })} · ${dynamicStats.harvestedTillNowM3.toFixed(2)} m³`}
            tip={t("live.sinceTip", { when: dynamicStats.startDate.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) })}
            tag="Live Tracking"
          />

          {/* 2. Money saved this month (clickable to open monthly report dialog) */}
          <Card
            gradient="bg-emerald-600"
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
            gradient="bg-teal-600"
            icon={<CalendarClock className="h-6 w-6 text-teal-200" />}
            label="Paid off in"
            value={dynamicStats.remainingYears !== null ? `${dynamicStats.remainingYears.toFixed(1)} years` : "N/A"}
            sub={`₹${Math.round(dynamicStats.remainingCost).toLocaleString(locale)} remaining of ${formatCurrency(dynamicStats.netCost)} cost`}
            tip="Estimated remaining time to break even based on initial investment minus cumulative savings."
            tag={subsidyAmount > 0 ? "with subsidy" : "ROI on track"}
          />
        </motion.div>

        {/* Live since installation: where the rain went, updating continuously */}
        <LiveFlow
          collectedM3={dynamicStats.harvestedTillNowM3}
          usedM3={dynamicStats.usedM3}
          groundM3={dynamicStats.groundM3}
          hasRecharge={!["storage_only", "not_feasible"].includes(String(result.recommended_option ?? ""))}
          sinceLabel={t(`live.since.${dynamicStats.elapsed.unit}`, { count: dynamicStats.elapsed.value })}
        />

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
        gradient="bg-blue-600"
        icon={<Droplets className="h-6 w-6" />}
        label={t("highlight.harvest")}
        value={`${harvestM3.toLocaleString(locale, { maximumFractionDigits: 1 })} m³`}
        sub={t("highlight.harvestSub", { litres, tankers: tankersPerYear(harvestM3) })}
        tip={t("highlight.harvestTip")}
      />
      <Card
        gradient="bg-emerald-600"
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
        gradient="bg-teal-600"
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
