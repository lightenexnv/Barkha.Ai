import { AlertTriangle, CloudRain, ExternalLink, Loader2, MapPin, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/InfoTip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import type { LocationClimate } from "@/hooks/useLocationClimate";
import { placeLine } from "./model";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Location-derived rainfall: annual mean, monthly distribution and its source. */
export const RainfallPanel = ({ climate, className }: { climate: LocationClimate; className?: string }) => {
  const { t, locale } = useLanguage();
  const { status, place, rainfall, error, offline, retry } = climate;

  if (status === "idle") {
    return (
      <div className={cn("rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground", className)}>
        <div className="flex items-center gap-2">
          <CloudRain className="h-5 w-5 shrink-0 text-primary/70" />
          <span>{t("climate.idle")}</span>
        </div>
      </div>
    );
  }

  if (status === "loading" && !rainfall) {
    return (
      <div className={cn("space-y-3 rounded-xl border border-border/60 bg-card/60 p-5", className)} aria-busy="true">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          {t("climate.loading")}
        </div>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (status === "error" || !rainfall) {
    return (
      <div className={cn("space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5", className)} role="alert">
        <div className="flex items-start gap-2 text-sm">
          {offline ? (
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <div>
            <p className="font-medium">{t("climate.error")}</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={retry}>
          <RefreshCw className="me-2 h-4 w-4" />
          {t("climate.retry")}
        </Button>
      </div>
    );
  }

  const peak = Math.max(...rainfall.monthly, 1);
  const wettest = rainfall.monthly.indexOf(Math.max(...rainfall.monthly));
  const where = placeLine(place);

  return (
    <div
      className={cn(
        "relative space-y-4 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-5",
        status === "loading" && "opacity-70",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-primary">
            {t("climate.annual")}
            <InfoTip>
              {t("climate.source")}{" "}
              <a href={rainfall.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
                {rainfall.source}
                <ExternalLink className="h-3 w-3" />
              </a>
              . {t("result.rainTip", { period: rainfall.period, source: "this record" }).split(". ").slice(1).join(". ")}
            </InfoTip>
          </p>
          <p className="text-3xl font-bold tabular-nums">
            {rainfall.annual.toLocaleString(locale)} <span className="text-lg font-semibold text-muted-foreground">mm</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {t("climate.period", { period: rainfall.period, years: rainfall.yearly.length })}
          </p>
        </div>
        {where && (
          <div className="flex max-w-[16rem] items-start gap-1.5 rounded-lg bg-background/70 px-3 py-2 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{where}</span>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {t("climate.monthly", { month: MONTH_NAMES[wettest] })}
        </p>
        <div className="flex h-24 items-end gap-1" role="img" aria-label={t("climate.monthlyAria")}>
          {rainfall.monthly.map((value, index) => (
            <div key={index} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div className="relative flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-primary transition-all duration-500 group-hover:bg-accent"
                  style={{ height: `${Math.max(2, (value / peak) * 100)}%` }}
                  title={`${MONTH_NAMES[index]}: ${value.toLocaleString(locale)} mm`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{MONTHS[index]}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
