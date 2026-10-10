// How deep real satellite imagery goes at a point.
//
// Esri World Imagery coverage varies by place: cities often have zoom 19,
// rural areas may stop at 17 or 18. Where a level is missing the tile server
// still answers HTTP 200 with a grey "Map data not yet available" image, so
// the map cannot detect it from the tile itself. The service's tilemap
// endpoint reports whether a real tile exists, which lets the map request the
// deepest real level and enlarge it instead of showing placeholders.

const TILEMAP_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tilemap";
export const MAX_IMAGERY_ZOOM = 19;
const MIN_PROBE_ZOOM = 15;

const cache = new Map<string, number>();

const tileAt = (latitude: number, longitude: number, zoom: number) => {
  const n = 2 ** zoom;
  const lat = (Math.max(-85, Math.min(85, latitude)) * Math.PI) / 180;
  const x = Math.floor(((longitude + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n);
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
};

const hasTile = async (zoom: number, x: number, y: number, signal?: AbortSignal) => {
  const response = await fetch(`${TILEMAP_URL}/${zoom}/${y}/${x}/1/1`, { signal });
  if (!response.ok) throw new Error(`tilemap HTTP ${response.status}`);
  const body = (await response.json()) as { data?: number[] };
  return body.data?.[0] === 1;
};

/**
 * Deepest zoom level with real imagery at a point (15..19). Throws if the
 * availability service cannot be reached, so callers can keep their default.
 */
export const deepestImageryZoom = async (latitude: number, longitude: number, signal?: AbortSignal): Promise<number> => {
  // Coverage changes over areas far larger than a zoom-16 tile (~600 m)
  const { x, y } = tileAt(latitude, longitude, 16);
  const key = `${x}/${y}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  for (let zoom = MAX_IMAGERY_ZOOM; zoom > MIN_PROBE_ZOOM; zoom--) {
    const tile = tileAt(latitude, longitude, zoom);
    if (await hasTile(zoom, tile.x, tile.y, signal)) {
      cache.set(key, zoom);
      return zoom;
    }
  }
  cache.set(key, MIN_PROBE_ZOOM);
  return MIN_PROBE_ZOOM;
};
