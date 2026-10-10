import { motion } from "framer-motion";
import { CalendarClock, Droplets, PiggyBank } from "lucide-react";
import { InfoTip } from "@/components/InfoTip";
import { fadeUp, stagger } from "@/components/motion/presets";
import { useLanguage } from "@/context/LanguageContext";
import { formatCurrency } from "@/lib/api";
import { cn } from "@/lib/utils";

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
}

const Card = ({
  gradient,
  icon,
  label,
  value,
  sub,
  tip,
}: {
  gradient: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tip: string;
}) => (
  <motion.div
    variants={fadeUp}
    whileHover={{ y: -4 }}
    transition={{ type: "spring", stiffness: 300, damping: 22 }}
    className={cn("relative overflow-hidden rounded-2xl p-5 text-white shadow-lg", gradient)}
  >
    <div aria-hidden="true" className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 blur-sm" />
    <div className="relative flex items-start justify-between gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">{icon}</span>
      <InfoTip className="text-white/80 hover:bg-white/20 hover:text-white">{tip}</InfoTip>
    </div>
    <p className="relative mt-4 text-sm font-medium text-white/85">{label}</p>
    <p className="relative text-3xl font-extrabold tracking-tight tabular-nums">{value}</p>
    <p className="relative mt-1 text-sm text-white/85">{sub}</p>
  </motion.div>
);

/** The three numbers people care about most, highlighted at the top of the results. */
export const HighlightCards = ({
  harvestM3,
  monthlySavings,
  annualSavings,
  waterUsedM3,
  tariff,
  paybackYears,
  paybackAfterSubsidy,
}: HighlightCardsProps) => {
  const { t, locale } = useLanguage();
  const litres = Math.round(harvestM3 * 1000).toLocaleString(locale);
  const years = (value: number) => (value < 1 ? t("highlight.underAYear") : t("result.years", { count: value.toFixed(1) }));

  return (
    <motion.div initial="hidden" animate="show" variants={stagger(0.1)} className="grid gap-4 md:grid-cols-3">
      <Card
        gradient="bg-gradient-to-br from-sky-500 via-blue-600 to-blue-800"
        icon={<Droplets className="h-6 w-6" />}
        label={t("highlight.harvest")}
        value={`${harvestM3.toLocaleString(locale, { maximumFractionDigits: 1 })} m³`}
        sub={t("highlight.harvestSub", { litres })}
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
        value={paybackYears === null ? t("highlight.notApplicable") : years(paybackYears)}
        sub={
          paybackYears === null
            ? t("highlight.noSavings")
            : paybackAfterSubsidy !== null && paybackAfterSubsidy < paybackYears
              ? t("highlight.afterSubsidy", { years: years(paybackAfterSubsidy) })
              : t("highlight.paybackSub")
        }
        tip={t("highlight.paybackTip")}
      />
    </motion.div>
  );
};
