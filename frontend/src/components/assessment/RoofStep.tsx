import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, MapPinned, PencilRuler, RotateCcw, ScanSearch, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { useUnits } from "@/context/SettingsContext";
import { api, ApiError } from "@/lib/api";
import { polygonAreaM2, type LatLon } from "@/lib/geo";
import { useSlowFlag } from "@/hooks/useSlowFlag";
import { EMPTY_ROOF, MAP_VIEWPORT_CLASS, MAX_ROOF_M2, type RoofState } from "./model";
import { SatelliteMap, type MapFocus } from "./SatelliteMap";

type Detection = { status: "idle" } | { status: "detecting" } | { status: "error"; message: string };

interface RoofStepProps {
  location: LatLon;
  roof: RoofState;
  onChange: (roof: RoofState) => void;
  onBack: () => void;
  onConfirm: () => void;
}

export const RoofStep = ({ location, roof, onChange, onBack, onConfirm }: RoofStepProps) => {
  const { t } = useLanguage();
  const units = useUnits();
  const [detection, setDetection] = useState<Detection>({ status: "idle" });
  const [manualArea, setManualArea] = useState(roof.method === "manual" ? String(roof.area) : "");
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const roofRef = useRef(roof);
  roofRef.current = roof;

  useEffect(() => () => controllerRef.current?.abort(), []);

  const detectAt = async (pin: LatLon) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    onChange({ ...EMPTY_ROOF, pin });
    setManualArea("");
    setDetection({ status: "detecting" });
    try {
      const found = await api.detectRoof(pin[0], pin[1], controller.signal);
      if (controller.signal.aborted) return;
      const polygon = found.polygon.map(([lat, lon]) => [lat, lon] as LatLon);
      // Zoom to the outline so its corners are far enough apart to drag
      setFocus({ center: pin, zoom: 21, bounds: polygon, key: `fit-${Date.now()}` });
      onChange({
        pin,
        polygon,
        detectedPolygon: polygon,
        area: polygonAreaM2(polygon),
        method: "detected",
        confidence: found.confidence,
        confirmed: false,
      });
      setDetection({ status: "idle" });
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      const message =
        error instanceof ApiError
          ? error.status === 0
            ? t("roof.serverUnreachable")
            : error.detail
          : t("roof.detectFailed");
      setDetection({ status: "error", message });
    }
  };

  const adjustPolygon = (polygon: LatLon[]) => {
    const current = roofRef.current;
    onChange({ ...current, polygon, area: polygonAreaM2(polygon), method: "adjusted", confirmed: false });
  };

  const resetToDetected = () => {
    const current = roofRef.current;
    if (!current.detectedPolygon) return;
    onChange({
      ...current,
      polygon: current.detectedPolygon,
      area: polygonAreaM2(current.detectedPolygon),
      method: "detected",
      confirmed: false,
    });
  };

  const applyManualArea = (raw: string) => {
    setManualArea(raw);
    const value = Number.parseFloat(raw);
    if (!raw.trim()) {
      // Clearing the box falls back to the detected outline, if any
      if (roof.method === "manual") {
        onChange(
          roof.polygon
            ? { ...roof, area: polygonAreaM2(roof.polygon), method: roof.detectedPolygon === roof.polygon ? "detected" : "adjusted", confirmed: false }
            : { ...roof, area: 0, method: null, confirmed: false },
        );
      }
      return;
    }
    if (Number.isFinite(value)) {
      onChange({ ...roof, area: Math.min(Math.max(value, 0), MAX_ROOF_M2), method: "manual", confirmed: false });
    }
  };

  const clearPin = () => {
    controllerRef.current?.abort();
    setDetection({ status: "idle" });
    setManualArea("");
    onChange(EMPTY_ROOF);
  };

  const detecting = detection.status === "detecting";
  const slowDetection = useSlowFlag(detecting);
  const areaValid = roof.area >= 1 && roof.area <= MAX_ROOF_M2;
  const lowConfidence = roof.method === "detected" && roof.confidence !== null && roof.confidence < 0.5;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold">{t("roof.title")}</h2>
          <p className="text-muted-foreground">{t("roof.subtitle")}</p>
        </div>

        <SatelliteMap
          initialCenter={roof.pin ?? location}
          initialZoom={19}
          focus={focus}
          pin={roof.pin}
          onPick={detecting ? undefined : detectAt}
          polygon={roof.polygon}
          onPolygonChange={roof.polygon && !detecting ? adjustPolygon : undefined}
          polygonTone={roof.method === "adjusted" ? "adjusted" : "detected"}
          className={cn(MAP_VIEWPORT_CLASS, !detecting && "[&_.leaflet-container]:cursor-crosshair")}
        >
          {/* Prompt / progress overlay */}
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center px-3">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-md transition-all",
                detecting ? "bg-primary text-primary-foreground" : "bg-background/85 text-foreground",
              )}
            >
              {detecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {slowDetection ? t("wizard.serverWaking") : t("roof.detecting")}
                </>
              ) : roof.polygon ? (
                <>
                  <PencilRuler className="h-4 w-4 text-primary" />
                  {t("roof.adjustHint")}
                </>
              ) : (
                <>
                  <MapPinned className="h-4 w-4 text-primary" />
                  {t("roof.prompt")}
                </>
              )}
            </div>
          </div>
          {detecting && <div className="pointer-events-none absolute inset-0 z-[999] animate-pulse bg-primary/10" />}
        </SatelliteMap>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{t("roof.mapHelp")}</span>
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setFocus({ center: roof.pin ?? location, zoom: 19, key: Date.now() })}
          >
            {t("roof.recenter")}
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="glass-card space-y-4 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">{t("roof.areaTitle")}</p>
            {roof.method && (
              <Badge variant={roof.method === "detected" ? "default" : "secondary"}>
                {t(roof.method === "detected" ? "roof.methodDetected" : roof.method === "adjusted" ? "roof.methodAdjusted" : "roof.methodManual")}
              </Badge>
            )}
          </div>

          <div>
            <p className="text-4xl font-bold tabular-nums">
              {areaValid ? units.area(roof.area) : "—"}
            </p>
            {roof.method === "detected" && roof.confidence !== null && (
              <p className={cn("mt-1 text-sm", lowConfidence ? "text-warning" : "text-muted-foreground")}>
                {t("roof.confidence", { value: Math.round(roof.confidence * 100) })}
              </p>
            )}
          </div>

          {detection.status === "error" && (
            <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium">{t("roof.noRoof")}</p>
                <p className="text-muted-foreground">{detection.message}</p>
              </div>
            </div>
          )}

          {lowConfidence && (
            <p className="rounded-lg bg-warning/10 p-3 text-sm">{t("roof.lowConfidence")}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {roof.pin && (
              <Button type="button" variant="outline" size="sm" onClick={clearPin} disabled={detecting}>
                <RotateCcw className="me-2 h-4 w-4" />
                {t("roof.repin")}
              </Button>
            )}
            {roof.pin && detection.status === "error" && (
              <Button type="button" variant="outline" size="sm" onClick={() => roof.pin && detectAt(roof.pin)}>
                <ScanSearch className="me-2 h-4 w-4" />
                {t("roof.retryDetect")}
              </Button>
            )}
            {roof.method === "adjusted" && roof.detectedPolygon && (
              <Button type="button" variant="outline" size="sm" onClick={resetToDetected}>
                <Undo2 className="me-2 h-4 w-4" />
                {t("roof.resetOutline")}
              </Button>
            )}
          </div>

          <div className="space-y-1.5 border-t border-border/60 pt-4">
            <Label htmlFor="manual-area">{t("roof.manualLabel")}</Label>
            <Input
              id="manual-area"
              type="number"
              min={1}
              step="any"
              inputMode="decimal"
              placeholder={t("roof.manualPlaceholder")}
              value={manualArea}
              onChange={(event) => applyManualArea(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("roof.manualHelp")}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <Button
            type="button"
            size="lg"
            variant="ocean"
            className="w-full"
            disabled={!areaValid || detecting}
            onClick={() => {
              onChange({ ...roof, confirmed: true });
              onConfirm();
            }}
          >
            <CheckCircle2 className="me-2 h-4 w-4" />
            {t("roof.confirm")}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
            <ArrowLeft className="me-2 h-4 w-4" />
            {t("wizard.back")}
          </Button>
        </div>
      </aside>
    </div>
  );
};
