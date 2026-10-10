import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Sparkles, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fadeUp } from "@/components/motion/presets";
import { useLanguage } from "@/context/LanguageContext";
import { formatCurrency, type Dossier } from "@/lib/api";
import { cn } from "@/lib/utils";

const scoreTone = (score: number) =>
  score >= 75 ? "text-success" : score >= 50 ? "text-primary" : score >= 30 ? "text-warning" : "text-destructive";

const ScoreRing = ({ score, size = 52 }: { score: number; size?: number }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", scoreTone(clamped))} style={{ width: size, height: size }}>
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
        <motion.circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: circumference * (1 - clamped / 100) }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <span className="text-sm font-bold tabular-nums">{Math.round(clamped)}</span>
    </span>
  );
};

const Sizes = ({ dossier }: { dossier: Dossier }) => (
  <ul className="flex flex-wrap gap-2" lang="en">
    {dossier.dimensions.map((item) => (
      <li key={item.label} className="rounded-lg border border-border/60 bg-background/70 px-3 py-1.5 text-sm">
        <span className="text-muted-foreground">{item.label}: </span>
        <span className="font-medium">{item.value}</span>
      </li>
    ))}
  </ul>
);

const Money = ({ dossier }: { dossier: Dossier }) => {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-xl bg-primary/5 p-3">
        <p className="text-xs text-muted-foreground">{t("rec.cost")}</p>
        <p className="text-lg font-bold tabular-nums">{formatCurrency(dossier.financial.total_cost)}</p>
      </div>
      <div className="rounded-xl bg-success/10 p-3">
        <p className="text-xs text-muted-foreground">{t("rec.yearly")}</p>
        <p className="text-lg font-bold tabular-nums text-success">{formatCurrency(dossier.benefits.annual_bill_savings)}</p>
      </div>
    </div>
  );
};

const OtherOption = ({ dossier }: { dossier: Dossier }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <li className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-start">
        <ScoreRing score={dossier.suitability.score} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium" lang="en">{dossier.title}</span>
          <span className="block text-sm text-muted-foreground" lang="en">
            {dossier.suitability.label} · {formatCurrency(dossier.financial.total_cost)}
          </span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="flex text-muted-foreground">
          <ChevronDown className="h-4 w-4" />
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
            <div className="space-y-3 border-t border-border/50 p-3">
              <p className="text-sm text-muted-foreground" lang="en">{dossier.description}</p>
              <Sizes dossier={dossier} />
              <p className="text-xs text-muted-foreground">{t("rec.yearlyShort", { amount: formatCurrency(dossier.benefits.annual_bill_savings) })}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
};

/** Final section: the recommended system, with the other options to compare. */
export const RecommendationSection = ({ dossiers }: { dossiers: Dossier[] }) => {
  const { t } = useLanguage();
  const ordered = [...dossiers].sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.suitability.score - a.suitability.score);
  const best = ordered.find((dossier) => dossier.recommended);
  const others = ordered.filter((dossier) => dossier !== best);

  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      aria-labelledby="rec-title"
      className="space-y-4"
    >
      <h2 id="rec-title" className="flex items-center gap-2 text-2xl font-bold">
        <Sparkles className="h-6 w-6 text-primary" />
        {t("rec.title")}
      </h2>

      {best ? (
        <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 shadow-[0_12px_40px_-16px_hsl(var(--primary)/0.5)] sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <ScoreRing score={best.suitability.score} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold" lang="en">{best.title}</h3>
                <Badge variant="success">{t("dossier.recommended")}</Badge>
              </div>
              <p className="text-muted-foreground" lang="en">{best.description}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <h4 className="mb-1 text-sm font-semibold">{t("dossier.justification")}</h4>
                <p className="text-sm" lang="en">{best.justification}</p>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">{t("rec.sizes")}</h4>
                <Sizes dossier={best} />
              </div>
            </div>
            <div className="space-y-4">
              <Money dossier={best} />
              <div>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                  <Wrench className="h-4 w-4 text-primary" />
                  {t("rec.upkeep")}
                </h4>
                <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground" lang="en">
                  {best.maintenance.slice(0, 3).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">{t("rec.notFeasible")}</div>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{t("rec.others")}</h3>
          <ul className="space-y-2">
            {others.map((dossier) => (
              <OtherOption key={dossier.id} dossier={dossier} />
            ))}
          </ul>
        </div>
      )}
    </motion.section>
  );
};
