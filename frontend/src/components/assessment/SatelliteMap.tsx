import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import type { LatLon } from "@/lib/geo";

// One continuous, seamless satellite canvas (Esri World Imagery tiles, the
// same source the roof detector segments), with a place-name overlay.
const IMAGERY_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABELS_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION =
  'Imagery &copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics &middot; Labels &copy; Esri';

const pinIcon = L.divIcon({
  className: "barkha-pin",
  html: `<svg viewBox="0 0 32 44" width="32" height="44" aria-hidden="true">
    <defs><linearGradient id="bp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22D3EE"/><stop offset="1" stop-color="#1166D6"/></linearGradient></defs>
    <path d="M16 1.5C8 1.5 1.8 7.6 1.8 15.4c0 10.4 12.3 25.6 13.3 26.8a1.2 1.2 0 0 0 1.8 0c1-1.2 13.3-16.4 13.3-26.8C30.2 7.6 24 1.5 16 1.5z" fill="url(#bp)" stroke="#fff" stroke-width="2.4"/>
    <circle cx="16" cy="15.5" r="5" fill="#fff"/></svg>`,
  iconSize: [32, 44],
  iconAnchor: [16, 42],
});

const vertexIcon = L.divIcon({
  className: "barkha-vertex",
  html: '<span class="barkha-vertex__dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export interface MapFocus {
  center: LatLon;
  zoom: number;
  /** When set, fit these points instead of using center/zoom */
  bounds?: LatLon[];
  /** Change to re-trigger the same focus */
  key: string | number;
}

interface SatelliteMapProps {
  initialCenter: LatLon;
  initialZoom: number;
  focus?: MapFocus | null;
  pin?: LatLon | null;
  onPick?: (point: LatLon) => void;
  polygon?: LatLon[] | null;
  /** Enables dragging the outline's corners */
  onPolygonChange?: (points: LatLon[]) => void;
  polygonTone?: "detected" | "adjusted";
  className?: string;
  children?: React.ReactNode;
}

// Releasing a dragged corner can also fire a map click; ignore clicks right after a drag
const lastVertexDrag = { at: 0 };

const ClickHandler = ({ onPick }: { onPick?: (point: LatLon) => void }) => {
  useMapEvents({
    click(event) {
      if (Date.now() - lastVertexDrag.at < 400) return;
      onPick?.([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
};

const FocusController = ({ focus }: { focus?: MapFocus | null }) => {
  const map = useMap();
  const lastKey = useRef<string | number | null>(null);
  useEffect(() => {
    if (!focus || focus.key === lastKey.current) return;
    lastKey.current = focus.key;
    if (focus.bounds && focus.bounds.length >= 2) {
      map.flyToBounds(L.latLngBounds(focus.bounds), { padding: [60, 60], maxZoom: focus.zoom, duration: 0.9 });
    } else {
      map.flyTo(focus.center, focus.zoom, { duration: 0.9 });
    }
  }, [focus, map]);
  return null;
};

/** Leaflet measures its box once; re-measure when the step animates in or resizes. */
const SizeWatcher = () => {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container);
    const timer = window.setTimeout(() => map.invalidateSize({ pan: false }), 350);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [map]);
  return null;
};

const EditableVertices = ({ points, onChange }: { points: LatLon[]; onChange: (points: LatLon[]) => void }) => {
  // Keep the latest outline in a ref so drag handlers never see a stale copy
  const latest = useRef(points);
  latest.current = points;

  return (
    <>
      {points.map((point, index) => (
        <Marker
          key={index}
          position={point}
          icon={vertexIcon}
          draggable
          keyboard={false}
          eventHandlers={{
            dragstart() {
              lastVertexDrag.at = Date.now();
            },
            dragend() {
              lastVertexDrag.at = Date.now();
            },
            drag(event) {
              lastVertexDrag.at = Date.now();
              const { lat, lng } = (event.target as L.Marker).getLatLng();
              const next = latest.current.slice();
              next[index] = [lat, lng];
              onChange(next);
            },
          }}
        />
      ))}
    </>
  );
};

export const SatelliteMap = ({
  initialCenter,
  initialZoom,
  focus,
  pin,
  onPick,
  polygon,
  onPolygonChange,
  polygonTone = "detected",
  className,
  children,
}: SatelliteMapProps) => {
  const polygonStyle = useMemo<L.PathOptions>(
    () => ({
      color: polygonTone === "adjusted" ? "#f59e0b" : "#22d3ee",
      weight: 3,
      fillColor: polygonTone === "adjusted" ? "#f59e0b" : "#22d3ee",
      fillOpacity: 0.28,
      dashArray: polygonTone === "adjusted" ? "6 4" : undefined,
    }),
    [polygonTone],
  );

  return (
    <div className={cn("barkha-map relative isolate overflow-hidden rounded-xl border border-border/60 bg-muted", className)}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        minZoom={3}
        maxZoom={21}
        zoomSnap={0.5}
        scrollWheelZoom
        worldCopyJump
        className="h-full w-full"
        attributionControl
      >
        <TileLayer url={IMAGERY_URL} attribution={ATTRIBUTION} maxNativeZoom={19} maxZoom={21} />
        <TileLayer url={LABELS_URL} maxNativeZoom={19} maxZoom={21} opacity={0.85} />
        <ClickHandler onPick={onPick} />
        <FocusController focus={focus} />
        <SizeWatcher />
        {polygon && polygon.length >= 3 && <Polygon positions={polygon} pathOptions={polygonStyle} interactive={false} />}
        {polygon && polygon.length >= 3 && onPolygonChange && (
          <EditableVertices points={polygon} onChange={onPolygonChange} />
        )}
        {pin && <Marker position={pin} icon={pinIcon} interactive={false} keyboard={false} />}
      </MapContainer>
      {children}
    </div>
  );
};
