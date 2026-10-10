import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, BellOff, CloudRain, Loader2, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/InfoTip";
import { fadeUp } from "@/components/motion/presets";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import type { AssessmentResult, SiteDetailsInput } from "@/lib/api";
import {
  FOLLOW_EVENT, FORECAST_SOURCE, HEAVY_RAIN_MM, fetchForecast, followSite, getFollowedSite, litresFrom,
  type ForecastDay, type RoofForCollection,
} from "@/lib/forecast";
import { cn } from "@/lib/utils";

const sameSite = (a: { latitude: number; longitude: number } | null, b: { latitude: number; longitude: number }) =>
  !!a && Math.abs(a.latitude - b.latitude) < 1e-4 && Math.abs(a.longitude - b.longitude) < 1e-4;

/** This week's rain for the roof, in litres, with a heads-up before heavy rain. */
export const MonsoonLive = ({ input, result }: { input: SiteDetailsInput; result: AssessmentResult }) => {
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const [days, setDays] = useState<ForecastDay[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [followed, setFollowed] = useState(() => sameSite(getFollowedSite(), input));

  const roof = useMemo<RoofForCollection>(
    () => ({
      areaM2: input.roof_area,
      efficiency: (result.hydrology?.runoff_coefficient ?? 0.8) * (result.hydrology?.condition_factor ?? 1),
      firstFlushMm: input.first_flush_mm ?? 1.5,
    }),
    [input.roof_area, input.first_flush_mm, result.hydrology],
  );

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetchForecast(input.latitude, input.longitude, controller.signal)
      .then(setDays)
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setFailed(true);
      });
    return () => controller.abort();
  }, [input.latitude, input.longitude]);

  useEffect(() => {
    const sync = () => setFollowed(sameSite(getFollowedSite(), input));
    window.addEventListener(FOLLOW_EVENT, sync);
    return () => window.removeEventListener(FOLLOW_EVENT, sync);
  }, [input]);

  const litres = days?.map((day) => litresFrom(day.mm, roof)) ?? [];
  const weekLitres = litres.reduce((sum, value) => sum + value, 0);
  const peak = Math.max(1, ...litres);
  const heavyIndex = days?.findIndex((day) => day.mm >= HEAVY_RAIN_MM) ?? -1;
  const dayName = (date: string, index: number) =>
    index === 0 ? t("live.today") : index === 1 ? t("live.tomorrow") : new Date(`${date}T00:00`).toLocaleDateString(locale, { weekday: "short" });

  // "today" / "tomorrow" / "on Sat" inside a sentence
  const dayPhrase = (date: string, index: number) =>
    index === 0 ? t("live.todayLower") : index === 1 ? t("live.tomorrowLower") : t("live.onDay", { day: dayName(date, index) });

  const toggleAlerts = async () => {
    if (followed) {
      followSite(null);
      toast({ title: t("live.alertsOff") });
      return;
    }
    let permission: NotificationPermission = "denied";
    if ("Notification" in window) {
      permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    }
    followSite({ name: input.site_name, latitude: input.latitude, longitude: input.longitude, ...roof });
    toast({
      title: t("live.alertsOn"),
      description: permission === "granted" ? t("live.alertsOnDesc") : t("live.alertsInApp"),
    });
  };

  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      aria-labelledby="live-title"
      className="glass-card overflow-hidden rounded-2xl"
    >
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
            <CloudRain className="h-5 w-5 text-sky-600" />
            <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          </span>
          <div>
            <h2 id="live-title" className="flex items-center gap-1.5 text-xl font-bold">
              {t("live.title")}
              <InfoTip>{t("live.tip", { source: FORECAST_SOURCE })}</InfoTip>
            </h2>
            <p className="text-sm text-muted-foreground">
              {days ? (weekLitres > 0 ? t("live.week", { litres: weekLitres.toLocaleString(locale) }) : t("live.dry")) : t("live.subtitle")}
            </p>
          </div>
        </div>
        <Button variant={followed ? "outline" : "ocean"} size="sm" onClick={toggleAlerts} className="shrink-0">
          {followed ? <BellOff className="me-2 h-4 w-4" /> : <Bell className="me-2 h-4 w-4" />}
          {followed ? t("live.stopAlerts") : t("live.getAlerts")}
        </Button>
      </div>

      {heavyIndex >= 0 && days && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-5 mb-4 flex items-start gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-sm sm:mx-6"
          role="alert"
        >
          <CloudRain className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <span>
            <span className="font-semibold">
              {t("live.heavy", { day: dayPhrase(days[heavyIndex].date, heavyIndex), mm: Math.round(days[heavyIndex].mm), litres: litres[heavyIndex].toLocaleString(locale) })}
            </span>{" "}
            {t("live.heavyTodo")}
          </span>
        </motion.div>
      )}

      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        {!days && !failed && (
          <div className="flex h-36 items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {failed && <p className="py-6 text-center text-sm text-muted-foreground">{t("live.failed")}</p>}
        {days && (
          <div className="grid grid-cols-7 gap-1.5 sm:gap-3" role="list" aria-label={t("live.title")}>
            {days.map((day, index) => {
              const value = litres[index];
              const heavy = day.mm >= HEAVY_RAIN_MM;
              return (
                <div key={day.date} role="listitem" className="flex flex-col items-center gap-1.5">
                  <span className="text-[11px] font-semibold tabular-nums text-muted-foreground sm:text-xs">
                    {value > 0 ? `${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value} L` : "—"}
                  </span>
                  <div className="flex h-24 w-full items-end overflow-hidden rounded-lg bg-muted/50">
                    <motion.div
                      className={cn("w-full rounded-lg", heavy ? "bg-blue-700" : "bg-sky-500")}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${value > 0 ? Math.max(6, (value / peak) * 100) : 0}%` }}
                      viewport={{ once: true }}
                      transition={{ type: "spring", stiffness: 120, damping: 18, delay: index * 0.05 }}
                    />
                  </div>
                  {day.mm >= 1 ? <CloudRain className={cn("h-4 w-4", heavy ? "text-blue-700" : "text-sky-500")} /> : <Sun className="h-4 w-4 text-amber-500" />}
                  <span className={cn("text-xs font-medium", index === 0 && "text-primary")}>{dayName(day.date, index)}</span>
                  <span className="text-[10px] text-muted-foreground">{day.mm.toFixed(day.mm < 10 ? 1 : 0)} mm</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.section>
  );
};
