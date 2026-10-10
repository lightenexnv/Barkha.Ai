import { useCallback, useEffect, useState } from "react";
import {
  ClimateError,
  fetchRainfall,
  isValidCoordinate,
  reverseGeocode,
  type Place,
  type Rainfall,
} from "@/lib/climate";

export type ClimateStatus = "idle" | "loading" | "ready" | "error";

export interface LocationClimate {
  status: ClimateStatus;
  place: Place | null;
  rainfall: Rainfall | null;
  error: string | null;
  offline: boolean;
  retry: () => void;
}

/**
 * Place name and rainfall for the given coordinates, refreshed whenever they
 * change (debounced so typing a coordinate doesn't fire a request per key).
 * The address lookup is best-effort; rainfall is required for "ready".
 */
export const useLocationClimate = (latitude: number, longitude: number, delayMs = 500): LocationClimate => {
  const [state, setState] = useState<Omit<LocationClimate, "retry">>({
    status: "idle",
    place: null,
    rainfall: null,
    error: null,
    offline: false,
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!isValidCoordinate(latitude, longitude)) {
      setState({ status: "idle", place: null, rainfall: null, error: null, offline: false });
      return;
    }
    const controller = new AbortController();
    setState((prev) => ({ ...prev, status: "loading", error: null, offline: false }));

    const timer = window.setTimeout(async () => {
      const [placeResult, rainResult] = await Promise.allSettled([
        reverseGeocode(latitude, longitude, controller.signal),
        fetchRainfall(latitude, longitude, controller.signal),
      ]);
      if (controller.signal.aborted) return;

      const place = placeResult.status === "fulfilled" ? placeResult.value : null;
      if (rainResult.status === "fulfilled") {
        setState({ status: "ready", place, rainfall: rainResult.value, error: null, offline: false });
      } else {
        const reason = rainResult.reason;
        setState({
          status: "error",
          place,
          rainfall: null,
          error: reason instanceof Error ? reason.message : "Rainfall data is unavailable.",
          offline: reason instanceof ClimateError && reason.offline,
        });
      }
    }, delayMs);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [latitude, longitude, delayMs, attempt]);

  // Retry automatically when the connection comes back
  useEffect(() => {
    if (!state.offline) return;
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [state.offline, retry]);

  return { ...state, retry };
};
