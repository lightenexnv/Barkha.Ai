// Location intelligence for an assessment: where a point is (city, district,
// state) and how much rain it gets. Rainfall is the mean of the last ten
// complete years of daily totals from Open-Meteo's historical archive (ERA5
// reanalysis), so every figure shown can be traced to a cited dataset.
// Nothing here invents numbers: failures surface as errors for the UI.

export interface Place {
  displayName: string;
  city: string;
  district: string;
  state: string;
  country: string;
  countryCode: string;
}

export interface Rainfall {
  /** Mean annual rainfall, mm */
  annual: number;
  /** Mean rainfall for Jan..Dec, mm */
  monthly: number[];
  /** Annual totals for each year used, oldest first */
  yearly: { year: number; total: number }[];
  /** e.g. "2016–2025" */
  period: string;
  source: string;
  sourceUrl: string;
}

export interface SearchResult {
  label: string;
  latitude: number;
  longitude: number;
}

export class ClimateError extends Error {
  constructor(message: string, public readonly offline = false) {
    super(message);
    this.name = "ClimateError";
  }
}

const NOMINATIM = "https://nominatim.openstreetmap.org";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
export const RAINFALL_SOURCE = "Open-Meteo Historical Weather API (ECMWF ERA5 reanalysis)";
export const RAINFALL_SOURCE_URL = "https://open-meteo.com/en/docs/historical-weather-api";
const YEARS = 10;

const placeCache = new Map<string, Place>();
const rainCache = new Map<string, Rainfall>();

export const isValidCoordinate = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  Math.abs(latitude) <= 85 &&
  Math.abs(longitude) <= 180 &&
  // 0,0 is the form's empty state, not a real site
  !(latitude === 0 && longitude === 0);

const fetchJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ClimateError("You appear to be offline. Reconnect to fetch location data.", true);
  }
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ClimateError("Could not reach the data service. Check your connection and retry.", true);
  }
  if (!response.ok) {
    throw new ClimateError(`The data service answered with HTTP ${response.status}. Please retry shortly.`);
  }
  return response.json() as Promise<T>;
};

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  municipality?: string;
  state_district?: string;
  county?: string;
  district?: string;
  state?: string;
  country?: string;
  country_code?: string;
}

const toPlace = (displayName: string, address: NominatimAddress = {}): Place => ({
  displayName,
  city: address.city || address.town || address.village || address.municipality || address.suburb || "",
  district: (address.state_district || address.district || address.county || "").replace(/\s+District$/i, ""),
  state: address.state || "",
  country: address.country || "",
  countryCode: (address.country_code || "").toUpperCase(),
});

/** City, district and state for a point (OpenStreetMap Nominatim). */
export const reverseGeocode = async (latitude: number, longitude: number, signal?: AbortSignal): Promise<Place> => {
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = placeCache.get(key);
  if (cached) return cached;

  const data = await fetchJson<{ display_name?: string; address?: NominatimAddress; error?: string }>(
    `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=14&accept-language=en&lat=${latitude}&lon=${longitude}`,
    signal,
  );
  if (data.error) throw new ClimateError("No address was found for this point.");
  const place = toPlace(data.display_name || "", data.address);
  placeCache.set(key, place);
  return place;
};

/** Free-text place search, biased to India but not limited to it. */
export const searchPlaces = async (query: string, signal?: AbortSignal): Promise<SearchResult[]> => {
  const q = query.trim();
  if (q.length < 3) return [];
  const data = await fetchJson<{ display_name: string; lat: string; lon: string }[]>(
    `${NOMINATIM}/search?format=jsonv2&limit=6&accept-language=en&countrycodes=in&q=${encodeURIComponent(q)}`,
    signal,
  );
  const results = data.length
    ? data
    : await fetchJson<{ display_name: string; lat: string; lon: string }[]>(
        `${NOMINATIM}/search?format=jsonv2&limit=6&accept-language=en&q=${encodeURIComponent(q)}`,
        signal,
      );
  return results
    .map((item) => ({ label: item.display_name, latitude: Number(item.lat), longitude: Number(item.lon) }))
    .filter((item) => isValidCoordinate(item.latitude, item.longitude));
};

/** Ten-year mean annual and monthly rainfall at a point. */
export const fetchRainfall = async (latitude: number, longitude: number, signal?: AbortSignal): Promise<Rainfall> => {
  // ERA5 cells are ~25 km across, so nearby points share a result
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = rainCache.get(key);
  if (cached) return cached;

  const lastYear = new Date().getFullYear() - 1;
  const firstYear = lastYear - YEARS + 1;
  const url =
    `${ARCHIVE}?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
    `&start_date=${firstYear}-01-01&end_date=${lastYear}-12-31&daily=precipitation_sum&timezone=auto`;
  const data = await fetchJson<{ daily?: { time: string[]; precipitation_sum: (number | null)[] } }>(url, signal);
  const times = data.daily?.time ?? [];
  const values = data.daily?.precipitation_sum ?? [];
  if (!times.length) throw new ClimateError("No rainfall record exists for this location.");

  // Sum by year and by (year, month), counting days that have data
  const yearTotals = new Map<number, { total: number; days: number }>();
  const monthTotals = new Map<string, number>();
  times.forEach((day, index) => {
    const value = values[index];
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    const year = Number(day.slice(0, 4));
    const month = Number(day.slice(5, 7)) - 1;
    const entry = yearTotals.get(year) ?? { total: 0, days: 0 };
    entry.total += value;
    entry.days += 1;
    yearTotals.set(year, entry);
    monthTotals.set(`${year}-${month}`, (monthTotals.get(`${year}-${month}`) ?? 0) + value);
  });

  // Use only years with at least 95% of days present
  const years = [...yearTotals.entries()].filter(([, entry]) => entry.days >= 347).map(([year]) => year).sort();
  if (years.length < 3) throw new ClimateError("The rainfall record for this location is incomplete.");

  const monthly = Array.from({ length: 12 }, (_, month) => {
    const sum = years.reduce((acc, year) => acc + (monthTotals.get(`${year}-${month}`) ?? 0), 0);
    return Math.round((sum / years.length) * 10) / 10;
  });
  const yearly = years.map((year) => ({ year, total: Math.round(yearTotals.get(year)!.total) }));
  const annual = Math.round(yearly.reduce((acc, entry) => acc + entry.total, 0) / years.length);

  const rainfall: Rainfall = {
    annual,
    monthly,
    yearly,
    period: `${years[0]}–${years[years.length - 1]}`,
    source: RAINFALL_SOURCE,
    sourceUrl: RAINFALL_SOURCE_URL,
  };
  rainCache.set(key, rainfall);
  return rainfall;
};
