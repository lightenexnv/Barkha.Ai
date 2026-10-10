import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssessmentResult } from "@/components/AssessmentResult";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/hooks/use-toast";
import { useLocationClimate } from "@/hooks/useLocationClimate";
import { api, type AssessmentResult as AssessmentResultType, type SiteDetailsInput } from "@/lib/api";
import { isValidCoordinate } from "@/lib/climate";
import { centroid, distanceM, type LatLon } from "@/lib/geo";
import { buildAssessmentEntry, deleteAssessment, saveAssessment } from "@/lib/historyService";
import { ROOF_CONDITION_OPTIONS, ROOF_MATERIAL_OPTIONS, SOIL_TYPE_OPTIONS } from "@/lib/siteOptions";
import { cn } from "@/lib/utils";
import { DetailsStep } from "./DetailsStep";
import { LocationStep } from "./LocationStep";
import { OptionCardGroup } from "./OptionCardGroup";
import { RoofStep } from "./RoofStep";
import { detailsValid, EMPTY_ROOF, MAX_DEMAND, placeLine, type RoofState, type SiteDetails } from "./model";
import { WorkflowStepper, type WorkflowStep } from "./WorkflowStepper";

export interface WizardSeed {
  location?: LatLon;
  roofArea?: number;
  siteName?: string;
}

/** Moving the location further than this from the pinned roof discards the roof. */
const ROOF_KEEP_RADIUS_M = 150;
const STEP_IDS = ["location", "roof", "details", "results"] as const;

type Computation =
  | { status: "idle" }
  | { status: "running" }
  | { status: "error"; message: string };

export const AssessmentWizard = ({ seed }: { seed?: WizardSeed }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const { preferences } = useSettings();

  const [step, setStep] = useState(0);
  // Furthest step opened so far; a later step unlocks only after its predecessor was visited
  const [maxVisited, setMaxVisited] = useState(0);
  const [location, setLocation] = useState<LatLon>(seed?.location ?? [0, 0]);
  const [roof, setRoof] = useState<RoofState>(() =>
    seed?.roofArea && seed.roofArea >= 1 ? { ...EMPTY_ROOF, area: seed.roofArea, method: "manual" } : EMPTY_ROOF,
  );
  const [details, setDetails] = useState<SiteDetails>({
    site_name: seed?.siteName ?? "",
    roof_material: preferences.defaultRoofMaterial,
    roof_condition: "good",
    soil_type: preferences.defaultSoilType,
    water_demand: 540,
  });
  const climate = useLocationClimate(location[0], location[1]);

  const [result, setResult] = useState<{ result: AssessmentResultType; input: SiteDetailsInput } | null>(null);
  const [computation, setComputation] = useState<Computation>({ status: "idle" });
  const requestId = useRef(0);
  const lastSignature = useRef<string | null>(null);
  const autoSavedId = useRef<string | null>(null);

  // Suggest a site name from the place once it is known
  const suggestedName = climate.place?.city ? t("details.defaultName", { place: climate.place.city }) : "";
  useEffect(() => {
    if (suggestedName) setDetails((d) => (d.site_name.trim() ? d : { ...d, site_name: suggestedName }));
  }, [suggestedName]);

  const completed = useMemo(
    () => [
      isValidCoordinate(location[0], location[1]) && climate.status === "ready",
      roof.confirmed && roof.area >= 1,
      detailsValid(details),
      result !== null,
    ],
    [location, climate.status, roof, details, result],
  );
  // The first incomplete step is as far as the user may go
  const firstIncomplete = completed.slice(0, 3).indexOf(false);
  const reachable = Math.min(firstIncomplete === -1 ? 3 : firstIncomplete, maxVisited + 1, 3);

  const goTo = useCallback(
    (index: number) => {
      setStep(index);
      setMaxVisited((visited) => Math.max(visited, index));
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [],
  );

  // A step can become unreachable when an earlier input changes; fall back
  useEffect(() => {
    if (step > reachable) setStep(reachable);
  }, [step, reachable]);

  const changeLocation = (point: LatLon) => {
    setLocation(point);
    const anchor = roof.polygon ? centroid(roof.polygon) : roof.pin;
    if (anchor && distanceM(anchor, point) > ROOF_KEEP_RADIUS_M) {
      setRoof(EMPTY_ROOF);
      toast({ title: t("wizard.roofCleared") });
    }
  };

  const siteInput = useMemo<SiteDetailsInput | null>(() => {
    if (!completed[0] || !completed[1] || !completed[2] || !climate.rainfall) return null;
    // Use the roof's own position when it was pinned, so reports point at the building
    const [latitude, longitude] = roof.polygon ? centroid(roof.polygon) : roof.pin ?? location;
    return {
      site_name: details.site_name.trim(),
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      roof_area: Math.round(roof.area * 10) / 10,
      roof_material: details.roof_material,
      roof_condition: details.roof_condition,
      soil_type: details.soil_type,
      annual_rainfall: climate.rainfall.annual,
      monthly_rainfall: climate.rainfall.monthly,
      rainfall_source: climate.rainfall.source,
      rainfall_period: climate.rainfall.period,
      city: climate.place?.city || undefined,
      district: climate.place?.district || undefined,
      state: climate.place?.state || undefined,
      water_demand: Math.min(Math.max(details.water_demand, 0), MAX_DEMAND),
      water_tariff: preferences.waterTariff,
      first_flush_mm: preferences.firstFlushMm,
      roof_polygon: roof.polygon ?? undefined,
    };
  }, [completed, climate.rainfall, climate.place, roof, location, details, preferences.waterTariff, preferences.firstFlushMm]);

  const runAssessment = useCallback(
    async (input: SiteDetailsInput, signature: string) => {
      const id = ++requestId.current;
      setComputation({ status: "running" });
      try {
        const next = await api.createAssessment(input);
        if (id !== requestId.current) return; // a newer request superseded this one
        lastSignature.current = signature;
        setResult({ result: next, input });
        setComputation({ status: "idle" });

        // Signed-in users keep the latest version of this assessment in their history
        if (user) {
          if (autoSavedId.current && autoSavedId.current !== next.assessment_id) {
            deleteAssessment(user.id, autoSavedId.current);
          }
          if (saveAssessment(buildAssessmentEntry(user.id, input, next))) autoSavedId.current = next.assessment_id;
        }
      } catch (error) {
        if (id !== requestId.current) return;
        console.error("Assessment failed:", error);
        setComputation({ status: "error", message: t("toast.assessmentFailedDesc") });
      }
    },
    [user, t],
  );

  // Recalculate whenever any input changes while the results are open
  const signature = siteInput ? JSON.stringify(siteInput) : null;
  useEffect(() => {
    if (step !== 3 || !siteInput || !signature || signature === lastSignature.current) return;
    const timer = window.setTimeout(() => runAssessment(siteInput, signature), result ? 450 : 0);
    return () => window.clearTimeout(timer);
  }, [step, siteInput, signature, runAssessment, result]);

  const startOver = () => {
    requestId.current++;
    lastSignature.current = null;
    autoSavedId.current = null;
    setResult(null);
    setComputation({ status: "idle" });
    setRoof(EMPTY_ROOF);
    setLocation([0, 0]);
    setDetails((d) => ({ ...d, site_name: "" }));
    setMaxVisited(0);
    goTo(0);
  };

  const steps: WorkflowStep[] = STEP_IDS.map((id) => ({
    id,
    label: t(`wizard.step.${id}` as const),
    hint: t(`wizard.hint.${id}` as const),
  }));

  const stale = result !== null && signature !== lastSignature.current;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <WorkflowStepper
        steps={steps}
        current={step}
        reachable={reachable}
        completed={completed.map((done, index) => done && index <= maxVisited)}
        onSelect={goTo}
      />

      <div key={STEP_IDS[step]} className="animate-in fade-in-0 slide-in-from-bottom-3 duration-500">
        {step === 0 && (
          <LocationStep
            location={location}
            onChange={changeLocation}
            climate={climate}
            canContinue={completed[0]}
            onContinue={() => goTo(1)}
          />
        )}

        {step === 1 && (
          <RoofStep
            location={location}
            roof={roof}
            onChange={setRoof}
            onBack={() => goTo(0)}
            onConfirm={() => goTo(2)}
          />
        )}

        {step === 2 && (
          <DetailsStep
            details={details}
            onChange={setDetails}
            roofArea={roof.area}
            annualRainfall={climate.rainfall?.annual ?? null}
            onBack={() => goTo(1)}
            onSubmit={() => goTo(3)}
          />
        )}

        {step === 3 && (
          <div className="space-y-6">
            <FineTunePanel
              details={details}
              onChange={setDetails}
              place={placeLine(climate.place)}
              busy={computation.status === "running"}
            />

            {computation.status === "error" && (
              <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                  <span>
                    <span className="font-medium">{t("toast.assessmentFailed")}.</span> {computation.message}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => siteInput && signature && runAssessment(siteInput, signature)}
                >
                  <RefreshCw className="me-2 h-4 w-4" />
                  {t("climate.retry")}
                </Button>
              </div>
            )}

            {result ? (
              <div className={cn("relative transition-opacity duration-300", (stale || computation.status === "running") && "opacity-60")}>
                {computation.status === "running" && (
                  <div className="sticky top-20 z-20 mx-auto mb-2 flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-lg">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("wizard.recalculating")}
                  </div>
                )}
                <AssessmentResult result={result.result} input={result.input} onNewAssessment={startOver} />
              </div>
            ) : (
              computation.status !== "error" && (
                <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p>{t("form.submitting")}</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/** Compact controls on the results step; any change re-runs the assessment. */
const FineTunePanel = ({
  details,
  onChange,
  place,
  busy,
}: {
  details: SiteDetails;
  onChange: (details: SiteDetails) => void;
  place: string;
  busy: boolean;
}) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const set = <K extends keyof SiteDetails>(key: K, value: SiteDetails[K]) => onChange({ ...details, [key]: value });

  return (
    <div className="glass-card rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start"
      >
        <span className="flex items-center gap-2.5">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          <span>
            <span className="block font-semibold">{t("wizard.fineTune")}</span>
            <span className="block text-sm text-muted-foreground">{place || t("wizard.fineTuneHint")}</span>
          </span>
        </span>
        <span className="flex items-center gap-2 text-sm font-medium text-primary">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {open ? t("wizard.hide") : t("wizard.adjust")}
        </span>
      </button>
      {open && (
        <div className="animate-in fade-in-0 space-y-5 border-t border-border/60 px-5 pb-5 pt-4">
          <div className="space-y-2">
            <Label>{t("form.roofMaterial")}</Label>
            <OptionCardGroup size="sm" label={t("form.roofMaterial")} options={ROOF_MATERIAL_OPTIONS} value={details.roof_material} onChange={(v) => set("roof_material", v)} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("form.roofCondition")}</Label>
              <OptionCardGroup size="sm" label={t("form.roofCondition")} options={ROOF_CONDITION_OPTIONS} value={details.roof_condition} onChange={(v) => set("roof_condition", v)} className="lg:grid-cols-3" />
            </div>
            <div className="space-y-2">
              <Label>{t("form.soilType")}</Label>
              <OptionCardGroup size="sm" label={t("form.soilType")} options={SOIL_TYPE_OPTIONS} value={details.soil_type} onChange={(v) => set("soil_type", v)} className="sm:grid-cols-4 lg:grid-cols-4" />
            </div>
          </div>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="tune-demand">{t("form.demand")}</Label>
            <Input
              id="tune-demand"
              type="number"
              min={0}
              max={MAX_DEMAND}
              step={10}
              value={details.water_demand}
              onChange={(event) => {
                const value = Number.parseFloat(event.target.value);
                set("water_demand", Number.isFinite(value) ? Math.min(Math.max(value, 0), MAX_DEMAND) : 0);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
