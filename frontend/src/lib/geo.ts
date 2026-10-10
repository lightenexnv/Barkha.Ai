// Small geodesy helpers for roof outlines (a few hundred metres at most, so a
// local equirectangular projection is accurate to well under 1%).

export type LatLon = [number, number];

const EARTH_RADIUS = 6_371_008.8; // metres, mean radius
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export const distanceM = ([lat1, lon1]: LatLon, [lat2, lon2]: LatLon) => {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(a)));
};

/** Ground area of a polygon in m² (shoelace on a local tangent plane). */
export const polygonAreaM2 = (points: LatLon[]) => {
  if (points.length < 3) return 0;
  const lat0 = rad(points.reduce((sum, [lat]) => sum + lat, 0) / points.length);
  const xy = points.map(([lat, lon]) => [rad(lon) * EARTH_RADIUS * Math.cos(lat0), rad(lat) * EARTH_RADIUS]);
  let twice = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    twice += x1 * y2 - x2 * y1;
  }
  return Math.abs(twice) / 2;
};

export const centroid = (points: LatLon[]): LatLon => [
  points.reduce((sum, [lat]) => sum + lat, 0) / points.length,
  points.reduce((sum, [, lon]) => sum + lon, 0) / points.length,
];

export const formatCoordinate = (value: number) => value.toFixed(5);
