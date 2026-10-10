import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/InfoTip";
import { fadeUp } from "@/components/motion/presets";
import type { ReplayState } from "@/components/hero/RainwaterIsland";
import { useLanguage } from "@/context/LanguageContext";
import type { AssessmentResult, SiteDetailsInput } from "@/lib/api";
import { cn } from "@/lib/utils";
import { levelAt, simulateYear } from "./replayModel";

const RainReplayScene = lazy(() => import("./RainReplayScene"));

const MONTH_MS = 1600;
const supportsWebGL = () => {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
};

/** A year of this site's real rainfall, animated on the 3D model: tank fills, gets used, overflows to recharge. */
export const RainReplay = ({
  input,
  result,
  isImplemented = false,
  implementedAt,
}: {
  input: SiteDetailsInput;
  result: AssessmentResult;
  isImplemented?: boolean;
  implementedAt?: string;
}) => {
  const { t, locale } = useLanguage();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { margin: "-80px" });
  const webgl = useMemo(supportsWebGL, []);

  const startMonth = useMemo(() => {
    if (!isImplemented || !implementedAt) return 0;
    try {
      return new Date(implementedAt).getMonth();
    } catch {
      return 0;
    }
  }, [isImplemented, implementedAt]);

  const usesTank = !["recharge_only", "not_feasible"].includes(result.recommended_option);
  const capacity = usesTank ? result.storage_recommendation.recommended_volume : 0;
  const year = useMemo(
    () =>
      simulateYear(
        result.hydrology?.monthly_rainfall ?? [],
        result.hydrology?.monthly_harvest ?? [],
        capacity,
        input.water_demand,
      ),
    [result.hydrology, capacity, input.water_demand],
  );

  const replay = useRef<ReplayState>({ tank: 0, rain: 0, recharge: 0 });
  const [playing, setPlaying] = useState(true);
  const [clock, setClock] = useState(() => (isImplemented ? startMonth : 0)); // months elapsed, fractional
  const last = useRef<number | null>(null);

  // Sync clock when implementation status changes
  useEffect(() => {
    if (isImplemented) {
      setClock(startMonth);
    }
  }, [isImplemented, startMonth]);

  // Advance the clock while playing and visible; drive the 3D scene from it
  useEffect(() => {
    if (!playing || !inView) {
      last.current = null;
      return;
    }
    let frame = 0;
    const tick = (now: number) => {
      if (last.current !== null) {
        setClock((value) => (value + (now - last.current!) / MONTH_MS) % 12);
      }
      last.current = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, inView]);

  const monthIndex = Math.floor(clock) % 12;
  const progress = clock - Math.floor(clock);
  const month = year.months[monthIndex];
  const level = month ? levelAt(month, progress) : 0;

  useEffect(() => {
    if (!month) return;
    replay.current.tank = capacity > 0 ? level / capacity : 0;
    replay.current.rain = progress < 0.6 ? Math.min(1, month.rainMm / year.maxRainMm) : 0;
    replay.current.recharge = month.overflowM3 > 0 || !usesTank ? Math.max(0.25, month.overflowM3 / year.maxOverflowM3) : 0.05;
  }, [month, level, progress, capacity, usesTank, year.maxRainMm, year.maxOverflowM3]);

  if (!result.hydrology?.monthly_harvest?.length || !month) return null;

  const litres = (m3: number) => Math.round(m3 * 1000).toLocaleString(locale);
  const soFar = (key: "inflowM3" | "overflowM3" | "usedM3") => {
    if (!isImplemented) {
      return year.months.slice(0, monthIndex).reduce((sum, m) => sum + m[key], 0) + month[key] * Math.min(1, progress * 2);
    }
    // Only calculate from the start month of implementation
    if (monthIndex < startMonth) {
      return 0; // Pre-implementation month
    }
    const fromStart = year.months.slice(startMonth, monthIndex);
    return fromStart.reduce((sum, m) => sum + m[key], 0) + month[key] * Math.min(1, progress * 2);
  };
  const monthName = (index: number) => new Date(2025, index, 1).toLocaleDateString(locale, { month: "short" });
  const tankPct = capacity > 0 ? Math.round((level / capacity) * 100) : 0;

  return (
    <motion.section
      ref={box}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      aria-labelledby="replay-title"
      className="glass-card overflow-hidden rounded-2xl"
    >
      <div className="flex items-start justify-between gap-3 p-5 sm:p-6">
        <div>
          <h2 id="replay-title" className="flex flex-wrap items-center gap-2 text-xl font-bold">
            {t("replay.title")}
            <InfoTip>{t("replay.tip")}</InfoTip>
            {isImplemented && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                ● Live Since {monthName(startMonth)}
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isImplemented
              ? `Replaying dynamic water collection starting from your implementation date (${monthName(startMonth)}).`
              : t("replay.subtitle")}
          </p>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="relative h-[300px] bg-sky-50 sm:h-[380px] lg:h-auto lg:min-h-[400px] dark:bg-sky-950/30">
          {webgl && inView ? (
            <Suspense fallback={null}>
              <RainReplayScene replay={replay} playing={playing} tankDetail={capacity > 0 ? `${litres(capacity)} L` : t("replay.noTank")} />
            </Suspense>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{webgl ? "" : t("replay.no3d")}</div>
          )}
          <motion.div
            key={monthIndex}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute start-4 top-4 rounded-xl bg-background/85 px-4 py-2 shadow-md backdrop-blur"
          >
            <p className="text-2xl font-extrabold">{monthName(monthIndex)}</p>
            <p className="text-xs text-muted-foreground">{t("replay.rainThisMonth", { mm: Math.round(month.rainMm) })}</p>
          </motion.div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {capacity > 0 && (
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium">{t("replay.tank")}</span>
                <span className="tabular-nums text-muted-foreground">{tankPct}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-600 transition-[width] duration-150" style={{ width: `${tankPct}%` }} />
              </div>
            </div>
          )}
          <dl className="grid grid-cols-1 gap-2 text-sm min-[420px]:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-xl bg-sky-500/10 p-3">
              <dt className="text-xs text-muted-foreground">{t("replay.collected")}</dt>
              <dd className="text-lg font-bold tabular-nums">{litres(soFar("inflowM3"))} L</dd>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <dt className="text-xs text-muted-foreground">{t("replay.used")}</dt>
              <dd className="text-lg font-bold tabular-nums">{litres(soFar("usedM3"))} L</dd>
            </div>
            <div className="rounded-xl bg-teal-500/10 p-3">
              <dt className="text-xs text-muted-foreground">{t("replay.recharged")}</dt>
              <dd className="text-lg font-bold tabular-nums">{litres(soFar("overflowM3"))} L</dd>
            </div>
          </dl>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ocean" onClick={() => setPlaying((value) => !value)} aria-label={playing ? t("replay.pause") : t("replay.play")}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setClock(isImplemented ? startMonth : 0)} aria-label={t("replay.restart")}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-6 gap-1" role="group" aria-label={t("replay.months")}>
            {year.months.map((m, index) => {
              const isPreImpl = isImplemented && index < startMonth;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setClock(index + 0.55)}
                  className={cn(
                    "relative overflow-hidden rounded-md border py-1 text-[11px] font-medium transition-colors",
                    index === monthIndex
                      ? "border-primary text-primary shadow-sm"
                      : isPreImpl
                        ? "border-border/40 text-muted-foreground/60 bg-muted/20"
                        : "border-border/60 text-muted-foreground hover:border-primary/50",
                  )}
                  title={isPreImpl ? "Pre-implementation period" : "Active harvesting month"}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-x-0 bottom-0",
                      isPreImpl ? "bg-muted-foreground/15" : "bg-sky-400/25",
                    )}
                    style={{ height: `${(m.rainMm / year.maxRainMm) * 100}%` }}
                  />
                  <span className="relative">{monthName(index)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.section>
  );
};
