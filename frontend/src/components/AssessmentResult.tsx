import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown, CloudRain, LogIn, MapPin, RotateCcw, Ruler, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DrawnIcon } from "@/components/DrawnIcon";
import { InfoTip } from "@/components/InfoTip";
import { ReportDownloadMenu } from "@/components/ReportDownloadMenu";
import { placeLine } from "@/components/assessment/model";
import { Pressable } from "@/components/motion/Motion";
import { fadeUp } from "@/components/motion/presets";
import { FinancialStatement } from "@/components/results/FinancialStatement";
import { HighlightCards } from "@/components/results/HighlightCards";
import { RecommendationSection } from "@/components/results/RecommendationSection";
import { SubsidyPanel } from "@/components/results/SubsidyPanel";
import { defaultSelection, subsidyAmount, type SubsidySelection } from "@/components/results/subsidy";
import { AssessmentResult as AssessmentResultType, SiteDetailsInput, formatCurrency } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useUnits } from "@/context/SettingsContext";
import { buildAssessmentEntry, saveAssessment, useAssessmentHistory } from "@/lib/historyService";
import type { TranslationKey } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AssessmentResultProps {
  result: AssessmentResultType;
  /** The inputs that produced this result, used for reports and saving. */
  input: SiteDetailsInput;
  onNewAssessment: () => void;
}

const RECOMMENDATION_KEYS: Record<string, TranslationKey> = {
  storage_only: "rec.storage_only",
  recharge_only: "rec.recharge_only",
  hybrid: "rec.hybrid",
  storage_priority_hybrid: "rec.storage_priority_hybrid",
  not_feasible: "rec.not_feasible",
};

export const getRecommendationColor = (recommendation: string) => {
  switch (recommendation) {
    case "hybrid":
    case "storage_priority_hybrid":
      return "success";
    case "storage_only":
    case "recharge_only":
      return "warning";
    case "not_feasible":
      return "destructive";
    default:
      return "secondary";
  }
};

/** Localized label for a backend recommendation code. */
export const useRecommendationLabel = () => {
  const { t } = useLanguage();
  return (recommendation: string) =>
    RECOMMENDATION_KEYS[recommendation] ? t(RECOMMENDATION_KEYS[recommendation]) : recommendation.replace(/_/g, " ");
};

/** Short, plain notes worth knowing; only the important ones are shown. */
const GoodToKnow = ({ checks }: { checks: string[] }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const important = checks.filter((check) => /^(IMPORTANT|NOTE|CRITICAL|WARNING)/.test(check));
  const rest = checks.filter((check) => !important.includes(check));
  if (!checks.length) return null;
  const strip = (check: string) => check.replace(/^[A-Z]+:\s*/, "");

  return (
    <motion.section variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="glass-card rounded-2xl">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 p-5 text-start">
        <span className="flex items-center gap-2.5">
          <ShieldAlert className="h-5 w-5 text-warning" />
          <span>
            <span className="block font-semibold">{t("result.goodToKnow")}</span>
            <span className="block text-sm text-muted-foreground">
              {important.length ? t("result.goodToKnowCount", { count: important.length }) : t("result.goodToKnowNone")}
            </span>
          </span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="flex text-muted-foreground">
          <ChevronDown className="h-5 w-5" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="overflow-hidden"
          >
            <ul className="space-y-2 px-5 pb-5 text-sm" lang="en">
              {[...important, ...rest].map((check) => (
                <li
                  key={check}
                  className={cn(
                    "rounded-lg border-s-4 px-3 py-2",
                    /^(IMPORTANT|CRITICAL)/.test(check)
                      ? "border-destructive bg-destructive/10"
                      : /^(NOTE|WARNING)/.test(check)
                        ? "border-warning bg-warning/10"
                        : "border-primary/40 bg-muted/40",
                  )}
                >
                  {strip(check)}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
};

export const AssessmentResult = ({ result, input, onNewAssessment }: AssessmentResultProps) => {
  const { t } = useLanguage();
  const units = useUnits();
  const { user, openAuthModal } = useAuth();
  const { toast } = useToast();
  const history = useAssessmentHistory(user?.id);
  const isSaved = history.some((entry) => entry.id === result.assessment_id);
  const [subsidy, setSubsidy] = useState<SubsidySelection>(() => defaultSelection(result.subsidies));

  const handleSave = () => {
    if (!user) return;
    if (saveAssessment(buildAssessmentEntry(user.id, input, result))) {
      toast({ title: t("result.savedBanner") });
    } else {
      toast({ title: t("report.failed"), variant: "destructive" });
    }
  };

  // Prefer the itemised statement total; older saved results only have cost_analysis
  const totalCost = result.financial_statement?.total_cost ?? result.cost_analysis.total_cost;
  const annualSavings = result.savings_analysis.annual_cost_savings;
  const subsidyOff = subsidyAmount(subsidy, result.subsidies, totalCost);
  const paybackYears = annualSavings > 0 ? totalCost / annualSavings : null;
  const paybackAfterSubsidy = annualSavings > 0 && subsidyOff > 0 ? (totalCost - subsidyOff) / annualSavings : null;
  const place = placeLine({ city: input.city ?? "", district: input.district ?? "", state: input.state ?? "" });
  const rainfall = result.hydrology?.annual_rainfall ?? input.annual_rainfall;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="show" variants={fadeUp} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold lg:text-4xl">
            {t("result.title1")} <span className="gradient-text">{t("result.title2")}</span>
          </h1>
          <p className="text-muted-foreground">{t("result.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pressable>
            <Button variant="outline" onClick={onNewAssessment}>
              <RotateCcw className="me-2 h-4 w-4" />
              {t("result.newAssessment")}
            </Button>
          </Pressable>
          <ReportDownloadMenu data={{ site: input, result }} />
        </div>
      </motion.div>

      {/* Account status */}
      <div
        className={cn(
          "flex flex-col justify-between gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center",
          isSaved ? "border-success/30 bg-success/10" : "border-primary/20 bg-primary/5",
        )}
      >
        <div className="flex items-center gap-2">
          {isSaved ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <DrawnIcon name="document" className="h-5 w-5 shrink-0 text-primary" />}
          <span>{isSaved ? t("result.savedBanner") : user ? t("result.unsavedBanner") : t("result.guestBanner")}</span>
        </div>
        {!isSaved &&
          (user ? (
            <Button size="sm" variant="ocean" onClick={handleSave}>
              <Save className="me-2 h-4 w-4" />
              {t("result.saveToAccount")}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={openAuthModal}>
              <LogIn className="me-2 h-4 w-4" />
              {t("auth.signIn")}
            </Button>
          ))}
      </div>

      {/* 1. The key numbers */}
      <HighlightCards
        harvestM3={result.harvestable_volume}
        monthlySavings={result.savings_analysis.monthly_savings}
        annualSavings={annualSavings}
        waterUsedM3={result.savings_analysis.annual_water_saved}
        tariff={result.savings_analysis.water_tariff_used}
        paybackYears={paybackYears}
        paybackAfterSubsidy={paybackAfterSubsidy}
      />

      {/* 2. The site these numbers are for */}
      <div className="grid gap-4 rounded-2xl border border-border/60 bg-card/60 p-4 text-sm sm:grid-cols-3">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">{t("result.site")}</p>
            <p className="font-medium">{input.site_name}</p>
            <p className="text-xs text-muted-foreground">{place || `${input.latitude.toFixed(4)}, ${input.longitude.toFixed(4)}`}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <CloudRain className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {t("climate.annual")}
              {input.rainfall_source && (
                <InfoTip>{t("result.rainTip", { period: input.rainfall_period ?? "", source: input.rainfall_source })}</InfoTip>
              )}
            </p>
            <p className="font-medium">{units.rainfall(rainfall)}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">{t("result.roof")}</p>
            <p className="font-medium">{units.area(input.roof_area)}</p>
            <p className="text-xs text-muted-foreground">
              {t("result.usesPerDay", { litres: input.water_demand.toLocaleString("en-IN") })}
            </p>
          </div>
        </div>
      </div>

      {/* 3. What it costs */}
      {result.financial_statement ? (
        <FinancialStatement statement={result.financial_statement} />
      ) : (
        <div className="glass-card flex items-center justify-between rounded-2xl p-5">
          <span className="font-semibold">{t("fin.total")}</span>
          <span className="text-2xl font-bold text-primary">{formatCurrency(totalCost)}</span>
        </div>
      )}

      {/* 4. Help with the cost */}
      {result.subsidies && (
        <SubsidyPanel subsidies={result.subsidies} grossCost={totalCost} selection={subsidy} onSelect={setSubsidy} />
      )}

      <GoodToKnow checks={result.safety_checks} />

      {/* 5. The recommendation, last */}
      {result.dossiers?.length ? (
        <RecommendationSection dossiers={result.dossiers} />
      ) : null}
    </div>
  );
};
