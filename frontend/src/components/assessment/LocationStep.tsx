import { useState } from "react";
import { ArrowRight, Crosshair, Loader2, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import type { LocationClimate } from "@/hooks/useLocationClimate";
import { isValidCoordinate } from "@/lib/climate";
import type { LatLon } from "@/lib/geo";
import { PlaceSearch } from "./PlaceSearch";
import { RainfallPanel } from "./RainfallPanel";
import { SatelliteMap, type MapFocus } from "./SatelliteMap";

const INDIA_CENTER: LatLon = [22.5, 79];

interface LocationStepProps {
  location: LatLon;
  onChange: (point: LatLon) => void;
  climate: LocationClimate;
  onContinue: () => void;
  canContinue: boolean;
}

export const LocationStep = ({ location, onChange, climate, onContinue, canContinue }: LocationStepProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const hasLocation = isValidCoordinate(location[0], location[1]);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [locating, setLocating] = useState(false);

  const moveTo = (point: LatLon, zoom = 17) => {
    onChange(point);
    setFocus({ center: point, zoom, key: `${point[0]},${point[1]},${Date.now()}` });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: t("toast.locationError"), description: t("toast.locationUnsupported"), variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        moveTo([position.coords.latitude, position.coords.longitude], 18);
        toast({ title: t("toast.locationUpdated"), description: t("toast.locationUpdatedDesc") });
      },
      () => {
        setLocating(false);
        toast({ title: t("toast.locationError"), description: t("toast.locationErrorDesc"), variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const setCoordinate = (index: 0 | 1, raw: string) => {
    const value = Number.parseFloat(raw);
    const next: LatLon = [...location];
    next[index] = Number.isFinite(value) ? value : 0;
    onChange(next);
    if (isValidCoordinate(next[0], next[1])) setFocus({ center: next, zoom: 17, key: `typed-${next.join(",")}` });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold">{t("location.title")}</h2>
          <p className="text-muted-foreground">{t("location.subtitle")}</p>
        </div>

        <PlaceSearch onSelect={(result) => moveTo([result.latitude, result.longitude], 17)} />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating}>
            {locating ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Crosshair className="me-2 h-4 w-4" />}
            {t("form.useLocation")}
          </Button>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MousePointerClick className="h-4 w-4" />
            {t("location.orClick")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="wizard-lat">{t("form.latitude")}</Label>
            <Input
              id="wizard-lat"
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="12.97160"
              value={hasLocation ? Number(location[0].toFixed(6)) : ""}
              onChange={(event) => setCoordinate(0, event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wizard-lon">{t("form.longitude")}</Label>
            <Input
              id="wizard-lon"
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="77.59460"
              value={hasLocation ? Number(location[1].toFixed(6)) : ""}
              onChange={(event) => setCoordinate(1, event.target.value)}
            />
          </div>
        </div>

        <RainfallPanel climate={climate} />

        <Button type="button" size="lg" variant="ocean" className="w-full" disabled={!canContinue} onClick={onContinue}>
          {t("location.continue")}
          <ArrowRight className="ms-2 h-4 w-4" />
        </Button>
      </div>

      <SatelliteMap
        initialCenter={hasLocation ? location : INDIA_CENTER}
        initialZoom={hasLocation ? 17 : 5}
        focus={focus}
        pin={hasLocation ? location : null}
        onPick={(point) => onChange(point)}
        className="h-[360px] sm:h-[460px] lg:h-full lg:min-h-[560px]"
      />
    </div>
  );
};
