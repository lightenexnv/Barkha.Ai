// Shared state shapes and helpers for the assessment workflow.
import type { ROOF_CONDITIONS, ROOF_MATERIALS, SOIL_TYPES } from "@/lib/api";
import type { Place } from "@/lib/climate";
import type { LatLon } from "@/lib/geo";

export interface RoofState {
  pin: LatLon | null;
  polygon: LatLon[] | null;
  /** Outline as returned by the detector, kept so edits can be undone */
  detectedPolygon: LatLon[] | null;
  area: number;
  method: "detected" | "adjusted" | "manual" | null;
  confidence: number | null;
  confirmed: boolean;
}

export const EMPTY_ROOF: RoofState = {
  pin: null,
  polygon: null,
  detectedPolygon: null,
  area: 0,
  method: null,
  confidence: null,
  confirmed: false,
};

export const MAX_ROOF_M2 = 100_000;

/**
 * Map height that keeps the whole map (controls and overlays included) on
 * screen below the navbar, progress bar and step title.
 */
export const MAP_VIEWPORT_CLASS = "h-[clamp(260px,calc(100svh-25rem),560px)] sm:h-[clamp(300px,calc(100svh-22rem),640px)]";

export interface SiteDetails {
  site_name: string;
  roof_material: (typeof ROOF_MATERIALS)[number];
  roof_condition: (typeof ROOF_CONDITIONS)[number];
  soil_type: (typeof SOIL_TYPES)[number];
  /** Litres per day; 0 means no household use (recharge only) */
  water_demand: number;
}

export const MAX_DEMAND = 100_000;

export const detailsValid = (details: SiteDetails) =>
  details.site_name.trim().length >= 2 && details.water_demand >= 0 && details.water_demand <= MAX_DEMAND;

/** "City, District, State" without repeats, e.g. when a city is its own district. */
export const placeLine = (place: Pick<Place, "city" | "district" | "state"> | null) =>
  place
    ? [place.city, place.district, place.state].filter((part, i, all) => part && all.indexOf(part) === i).join(", ")
    : "";
