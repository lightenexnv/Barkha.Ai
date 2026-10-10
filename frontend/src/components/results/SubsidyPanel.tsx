import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/InfoTip";
import { fadeUp } from "@/components/motion/presets";
import { useLanguage } from "@/context/LanguageContext";
import { formatCurrency, type SubsidyScheme, type SubsidySummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { subsidyAmount, type SubsidySelection } from "./subsidy";

const LEVEL_STYLES: Record<string, string> = {
  Central: "bg-primary/10 text-primary border-primary/30",
  State: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300",
  Local: "bg-muted text-muted-foreground border-border",
};

const Collapse = ({ open, children }: { open: boolean; children: React.ReactNode }) => (
  <AnimatePresence initial={false}>
    {open && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className="overflow-hidden"
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

const Radio = ({ checked }: { checked: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
      checked ? "border-primary" : "border-muted-foreground/40",
    )}
  >
    {checked && <motion.span layoutId="subsidy-dot" className="h-2.5 w-2.5 rounded-full bg-primary" />}
  </span>
);

const SchemeRow = ({ scheme, checked, onSelect }: { scheme: SubsidyScheme; checked: boolean; onSelect: () => void }) => {
  const { t } = useLanguage();
  const [details, setDetails] = useState(false);
  const levelKey = scheme.level === "Central" ? "subsidy.central" : scheme.level === "State" ? "subsidy.state" : "subsidy.local";

  return (
    <li className={cn("rounded-xl border bg-card transition-colors", checked ? "border-primary/60 bg-primary/5" : "border-border/60")}>
      <div className="flex items-start gap-3 p-3">
        <button type="button" role="radio" aria-checked={checked} onClick={onSelect} className="flex flex-1 items-start gap-3 text-start">
          <Radio checked={checked} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium leading-snug" lang="en">{scheme.name}</span>
              <Badge variant="outline" className={cn("text-[10px]", LEVEL_STYLES[scheme.level] ?? LEVEL_STYLES.Local)}>
                {t(levelKey)}
              </Badge>
            </span>
            <span className={cn("block text-sm", scheme.indicative_grant > 0 ? "font-semibold text-success" : "text-muted-foreground")}>
              {scheme.indicative_grant > 0 ? t("subsidy.upTo", { amount: formatCurrency(scheme.indicative_grant) }) : t("subsidy.noCash")}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setDetails((open) => !open)}
          aria-expanded={details}
          aria-label={t("subsidy.details")}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <motion.span animate={{ rotate: details ? 180 : 0 }} className="flex">
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </button>
      </div>
      <Collapse open={details}>
        <dl className="space-y-2 border-t border-border/50 px-3 pb-3 pt-2 text-sm" lang="en">
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">{t("subsidy.assistance")}</dt>
            <dd>{scheme.assistance}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">{t("subsidy.eligibility")}</dt>
            <dd>{scheme.eligibility}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted-foreground">{t("subsidy.howToApply")}</dt>
            <dd>{scheme.how_to_apply}</dd>
          </div>
          <a href={scheme.portal} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            {t("subsidy.portal")} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </dl>
      </Collapse>
    </li>
  );
};

/** Compact subsidy card: pick the scheme that applies and see the cost after it. */
export const SubsidyPanel = ({
  subsidies,
  grossCost,
  selection,
  onSelect,
}: {
  subsidies: SubsidySummary;
  grossCost: number;
  selection: SubsidySelection;
  onSelect: (selection: SubsidySelection) => void;
}) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const applied = subsidyAmount(selection, subsidies, grossCost);
  const customAmount = selection.kind === "custom" ? selection.amount : 0;

  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      aria-labelledby="subsidy-title"
      className="glass-card overflow-hidden rounded-2xl border-success/30"
    >
      <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15">
            <Landmark className="h-5 w-5 text-success" />
          </span>
          <div>
            <h2 id="subsidy-title" className="flex items-center gap-1.5 text-xl font-bold">
              {t("subsidy.title")}
              <InfoTip>{subsidies.disclaimer}</InfoTip>
            </h2>
            <p className="text-sm text-muted-foreground">{t("subsidy.pick")}</p>
          </div>
        </div>

        {/* Gross, applied subsidy and net cost, always visible */}
        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center text-sm sm:gap-4 lg:min-w-[440px]">
          <div>
            <dt className="text-xs text-muted-foreground">{t("subsidy.gross")}</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(grossCost)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("subsidy.applied")}</dt>
            <dd className="font-semibold tabular-nums text-success">− {formatCurrency(applied)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("subsidy.net")}</dt>
            <motion.dd key={applied} initial={{ scale: 0.9, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className="text-lg font-extrabold tabular-nums text-primary">
              {formatCurrency(grossCost - applied)}
            </motion.dd>
          </div>
        </dl>
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 border-t border-border/60 px-5 py-3 text-sm font-medium text-primary hover:bg-primary/5 sm:px-6"
      >
        <span>{open ? t("subsidy.hide") : t("subsidy.show", { count: subsidies.schemes.length })}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="flex">
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <Collapse open={open}>
        <div role="radiogroup" aria-label={t("subsidy.title")} className="space-y-2 px-5 pb-5 sm:px-6">
          <button
            type="button"
            role="radio"
            aria-checked={selection.kind === "none"}
            onClick={() => onSelect({ kind: "none" })}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border p-3 text-start text-sm",
              selection.kind === "none" ? "border-primary/60 bg-primary/5" : "border-border/60",
            )}
          >
            <Radio checked={selection.kind === "none"} />
            {t("subsidy.none")}
          </button>
          <ul className="space-y-2">
            {subsidies.schemes.map((scheme) => (
              <SchemeRow
                key={scheme.id}
                scheme={scheme}
                checked={selection.kind === "scheme" && selection.id === scheme.id}
                onSelect={() => onSelect({ kind: "scheme", id: scheme.id })}
              />
            ))}
          </ul>
          <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm", selection.kind === "custom" ? "border-primary/60 bg-primary/5" : "border-border/60")}>
            <button
              type="button"
              role="radio"
              aria-checked={selection.kind === "custom"}
              onClick={() => onSelect({ kind: "custom", amount: customAmount })}
              className="flex items-center gap-3 text-start"
            >
              <Radio checked={selection.kind === "custom"} />
              {t("subsidy.custom")}
            </button>
            <Input
              type="number"
              min={0}
              step={500}
              inputMode="numeric"
              aria-label={t("subsidy.custom")}
              placeholder="₹"
              value={selection.kind === "custom" && customAmount ? customAmount : ""}
              onChange={(event) => {
                const value = Number.parseFloat(event.target.value);
                onSelect({ kind: "custom", amount: Number.isFinite(value) ? Math.max(0, value) : 0 });
              }}
              className="h-9 w-40"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("subsidy.projection")}</p>
        </div>
      </Collapse>
    </motion.section>
  );
};
