import { ExternalLink, Landmark, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";
import { formatCurrency, type SubsidySummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const LEVEL_STYLES: Record<string, string> = {
  Central: "bg-primary/10 text-primary border-primary/30",
  State: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-300",
  Local: "bg-muted text-muted-foreground border-border",
};

/** Government schemes that may apply, with an indicative post-subsidy cost. */
export const SubsidyPanel = ({ subsidies }: { subsidies: SubsidySummary }) => {
  const { t } = useLanguage();
  const hasGrant = subsidies.indicative_subsidy > 0;

  return (
    <section
      aria-labelledby="subsidy-title"
      className="overflow-hidden rounded-2xl border-2 border-success/30 bg-gradient-to-br from-success/5 via-card to-primary/5"
    >
      <div className="flex flex-col gap-3 border-b border-success/20 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/15">
            <Landmark className="h-6 w-6 text-success" />
          </span>
          <div>
            <h2 id="subsidy-title" className="text-xl font-bold">{t("subsidy.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {subsidies.state ? t("subsidy.subtitleState", { state: subsidies.state }) : t("subsidy.subtitle")}
            </p>
          </div>
        </div>
      </div>

      <ul className="grid gap-4 p-5 md:grid-cols-2">
        {subsidies.schemes.map((scheme) => (
          <li
            key={scheme.id}
            className={cn(
              "flex flex-col gap-3 rounded-xl border bg-card/80 p-4",
              scheme.id === subsidies.applied_scheme ? "border-success shadow-md" : "border-border/60",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold leading-snug" lang="en">{scheme.name}</h3>
                <p className="text-xs text-muted-foreground" lang="en">{scheme.authority}</p>
              </div>
              <Badge variant="outline" className={cn("shrink-0", LEVEL_STYLES[scheme.level] ?? LEVEL_STYLES.Local)}>
                {t(scheme.level === "Central" ? "subsidy.central" : scheme.level === "State" ? "subsidy.state" : "subsidy.local")}
              </Badge>
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("subsidy.assistance")}</dt>
                <dd lang="en">{scheme.assistance}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("subsidy.eligibility")}</dt>
                <dd lang="en">{scheme.eligibility}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("subsidy.howToApply")}</dt>
                <dd lang="en">{scheme.how_to_apply}</dd>
              </div>
            </dl>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
              {scheme.indicative_grant > 0 ? (
                <span className="text-sm font-semibold text-success">
                  {t("subsidy.upTo", { amount: formatCurrency(scheme.indicative_grant) })}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">{t("subsidy.noCash")}</span>
              )}
              <a
                href={scheme.portal}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {t("subsidy.portal")}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 border-t border-success/20 bg-background/50 p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex gap-2.5 text-sm" role="note">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p>
            <span className="font-semibold">{t("subsidy.disclaimerTitle")} </span>
            <span className="text-muted-foreground" lang="en">{subsidies.disclaimer}</span>
          </p>
        </div>
        <div className="rounded-xl border border-dashed border-success/50 bg-card p-4 md:min-w-72">
          <p className="text-xs font-semibold uppercase tracking-wider text-success">{t("subsidy.netTitle")}</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-6">
              <dt className="text-muted-foreground">{t("fin.total")}</dt>
              <dd className="tabular-nums">{formatCurrency(subsidies.gross_cost)}</dd>
            </div>
            <div className="flex justify-between gap-6">
              <dt className="text-muted-foreground">− {t("subsidy.indicative")}</dt>
              <dd className="tabular-nums">{formatCurrency(subsidies.indicative_subsidy)}</dd>
            </div>
            <div className="flex justify-between gap-6 border-t border-border/60 pt-1.5 text-base font-bold">
              <dt>{t("subsidy.net")}</dt>
              <dd className="tabular-nums text-success">{formatCurrency(subsidies.indicative_net_cost)}</dd>
            </div>
          </dl>
          <p className="mt-1.5 text-xs italic text-muted-foreground">
            {hasGrant ? t("subsidy.projection") : t("subsidy.noGrant")}
          </p>
        </div>
      </div>
    </section>
  );
};
