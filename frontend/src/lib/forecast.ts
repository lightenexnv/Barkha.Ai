// Monsoon Live: the coming week's rain for a saved roof, turned into litres,
// plus opt-in rain alerts for one followed site (kept in this browser).
import { readJson, writeJson } from "@/lib/storage";

const FORECAST = "https://api.open-meteo.com/v1/forecast";
export const FORECAST_SOURCE = "Open-Meteo weather forecast";
export const HEAVY_RAIN_MM = 10;

export interface ForecastDay {
  date: string; // YYYY-MM-DD
  mm: number;
  chance: number | null; // % probability of rain
}

export interface RoofForCollection {
  areaM2: number;
  /** Runoff coefficient x condition factor */
  efficiency: number;
  firstFlushMm: number;
}

/** Litres a roof collects from one day's rain, after the first-flush loss. */
export const litresFrom = (mm: number, roof: RoofForCollection) =>
  Math.max(0, Math.round((mm - roof.firstFlushMm) * roof.areaM2 * roof.efficiency));

export const fetchForecast = async (latitude: number, longitude: number, signal?: AbortSignal): Promise<ForecastDay[]> => {
  const url =
    `${FORECAST}?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
    "&daily=precipitation_sum,precipitation_probability_max&forecast_days=7&timezone=auto";
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Forecast HTTP ${response.status}`);
  const data = (await response.json()) as {
    daily?: { time: string[]; precipitation_sum: (number | null)[]; precipitation_probability_max?: (number | null)[] };
  };
  const daily = data.daily;
  if (!daily?.time?.length) throw new Error("No forecast for this location");
  return daily.time.map((date, i) => ({
    date,
    mm: Math.max(0, daily.precipitation_sum[i] ?? 0),
    chance: daily.precipitation_probability_max?.[i] ?? null,
  }));
};

/* ---------------- followed site for alerts ---------------- */

const FOLLOW_KEY = "barkha_rain_alert_site";
const NOTIFIED_KEY = "barkha_rain_alert_notified";
export const FOLLOW_EVENT = "barkha:rain-alert-changed";

export interface FollowedSite extends RoofForCollection {
  name: string;
  latitude: number;
  longitude: number;
}

export const getFollowedSite = () => readJson<FollowedSite | null>(FOLLOW_KEY, null);

export const followSite = (site: FollowedSite | null) => {
  writeJson(FOLLOW_KEY, site);
  window.dispatchEvent(new Event(FOLLOW_EVENT));
};

/** Dates already alerted, so each heavy-rain day notifies once. */
export const wasNotified = (date: string) => readJson<string[]>(NOTIFIED_KEY, []).includes(date);
export const markNotified = (date: string) => {
  const dates = readJson<string[]>(NOTIFIED_KEY, []).filter((d) => d >= new Date().toISOString().slice(0, 10));
  writeJson(NOTIFIED_KEY, [...dates, date]);
};
