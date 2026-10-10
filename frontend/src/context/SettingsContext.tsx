import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ROOF_MATERIALS, SOIL_TYPES } from "@/lib/api";
import { readJson, writeJson } from "@/lib/storage";

const PREFERENCES_KEY = "barkha_preferences";

export const DEFAULT_WATER_TARIFF = 50; // ₹ per m³, matches the backend default

/** Municipal tariff presets (₹ per m³). "" is the national default. */
export const STATE_PRESETS = [
  { code: "", name: "", tariff: DEFAULT_WATER_TARIFF },
  { code: "MH", name: "Maharashtra", tariff: 55 },
  { code: "DL", name: "Delhi", tariff: 45 },
  { code: "KA", name: "Karnataka", tariff: 50 },
  { code: "TN", name: "Tamil Nadu", tariff: 48 },
] as const;

export type RainfallSource = "open-meteo" | "nasa-power" | "manual";
export type UnitSystem = "metric" | "imperial";

export interface Preferences {
  regionState: string;
  waterTariff: number;
  units: UnitSystem;
  rainfallSource: RainfallSource;
  firstFlushMm: number;
  defaultRoofMaterial: (typeof ROOF_MATERIALS)[number];
  defaultSoilType: (typeof SOIL_TYPES)[number];
  animations: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  regionState: "",
  waterTariff: DEFAULT_WATER_TARIFF,
  units: "metric",
  rainfallSource: "open-meteo",
  firstFlushMm: 1.5,
  defaultRoofMaterial: "concrete",
  defaultSoilType: "loamy",
  animations: true,
};

interface SettingsContextValue {
  preferences: Preferences;
  updatePreferences: (changes: Partial<Preferences>) => void;
  resetPreferences: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const loadPreferences = (): Preferences => {
  // Merge over the defaults so preferences saved by older versions stay valid
  const saved = readJson<Partial<Preferences>>(PREFERENCES_KEY, {});
  const merged = { ...DEFAULT_PREFERENCES, ...(saved && typeof saved === "object" ? saved : {}) };
  // Only state, units and animations are user-facing. Engineering values stay at the
  // calibrated defaults (the tariff follows the state), ignoring any older saved overrides.
  const preset = STATE_PRESETS.find((option) => option.code === merged.regionState) ?? STATE_PRESETS[0];
  return {
    ...DEFAULT_PREFERENCES,
    regionState: preset.code,
    waterTariff: preset.tariff,
    units: merged.units,
    animations: merged.animations,
  };
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);

  const updatePreferences = useCallback((changes: Partial<Preferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...changes };
      writeJson(PREFERENCES_KEY, next);
      return next;
    });
  }, []);

  const resetPreferences = useCallback(() => setPreferences(DEFAULT_PREFERENCES), []);

  // Pauses floating/pinging decorations (see .no-3d-motion in index.css)
  useEffect(() => {
    document.documentElement.classList.toggle("no-3d-motion", !preferences.animations);
  }, [preferences.animations]);

  const value = useMemo(
    () => ({ preferences, updatePreferences, resetPreferences }),
    [preferences, updatePreferences, resetPreferences],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider");
  return context;
};

const SQ_FT_PER_M2 = 10.7639;
const US_GALLONS_PER_M3 = 264.172;
const FEET_PER_M = 3.28084;
const MM_PER_INCH = 25.4;

/** Formatters that show metric values in the user's chosen unit system. */
export const useUnits = () => {
  const { preferences } = useSettings();
  const imperial = preferences.units === "imperial";

  return useMemo(() => {
    const number = (value: number, digits = 2) =>
      (Number.isFinite(value) ? value : 0).toLocaleString("en-IN", { maximumFractionDigits: digits });

    return {
      imperial,
      area: (m2: number) => (imperial ? `${number(m2 * SQ_FT_PER_M2, 0)} ft²` : `${number(m2)} m²`),
      volume: (m3: number) => (imperial ? `${number(m3 * US_GALLONS_PER_M3, 0)} gal` : `${number(m3)} m³`),
      length: (m: number) => (imperial ? `${number(m * FEET_PER_M)} ft` : `${number(m)} m`),
      rainfall: (mm: number) => (imperial ? `${number(mm / MM_PER_INCH, 1)} in` : `${number(mm, 0)} mm`),
    };
  }, [imperial]);
};
