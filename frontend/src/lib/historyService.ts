// Account-bound assessment history, stored per user in localStorage under
// barkha_user_assessments_<userId>. Guests have no history.
import { useEffect, useState } from "react";
import type { AssessmentResult, SiteDetailsInput } from "@/lib/api";
import { readJson, writeJson } from "@/lib/storage";

const HISTORY_EVENT = "barkha:history-changed";
const keyFor = (userId: string) => `barkha_user_assessments_${userId}`;

export interface SatelliteSummary {
  roof_area: number;
  annual_rainfall: number;
  annual_harvest_m3: number;
  daily_average_liters: number;
}

export interface SavedAssessment {
  id: string;
  userId: string;
  kind: "assessment" | "satellite";
  createdAt: string;
  site: Partial<SiteDetailsInput> & { site_name: string };
  /** Full result for assessments; null for satellite analyses. */
  result: AssessmentResult | null;
  satellite?: SatelliteSummary;
}

export const listAssessments = (userId: string): SavedAssessment[] => {
  const entries = readJson<SavedAssessment[]>(keyFor(userId), []);
  if (!Array.isArray(entries)) return [];
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const getAssessment = (userId: string, id: string) =>
  listAssessments(userId).find((entry) => entry.id === id) ?? null;

export const isSaved = (userId: string, id: string) => getAssessment(userId, id) !== null;

const write = (userId: string, entries: SavedAssessment[]) => {
  const ok = writeJson(keyFor(userId), entries);
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT, { detail: { userId } }));
  return ok;
};

/** Insert or replace by id. Returns false if the browser refused to store it. */
export const saveAssessment = (entry: SavedAssessment): boolean => {
  const others = listAssessments(entry.userId).filter((existing) => existing.id !== entry.id);
  return write(entry.userId, [entry, ...others]);
};

export const deleteAssessment = (userId: string, id: string) =>
  write(
    userId,
    listAssessments(userId).filter((entry) => entry.id !== id),
  );

export const buildAssessmentEntry = (
  userId: string,
  site: SiteDetailsInput,
  result: AssessmentResult,
): SavedAssessment => ({
  id: result.assessment_id,
  userId,
  kind: "assessment",
  createdAt: new Date().toISOString(),
  site,
  result,
});

/** Harvestable volume per year (m³) for either kind of entry. */
export const entryVolume = (entry: SavedAssessment) =>
  entry.result?.harvestable_volume ?? entry.satellite?.annual_harvest_m3 ?? 0;

/** Live list of a user's saved assessments; updates on save/delete in any tab. */
export const useAssessmentHistory = (userId: string | null | undefined) => {
  const [entries, setEntries] = useState<SavedAssessment[]>(() => (userId ? listAssessments(userId) : []));

  useEffect(() => {
    const refresh = () => setEntries(userId ? listAssessments(userId) : []);
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (userId && event.key === keyFor(userId)) refresh();
    };
    window.addEventListener(HISTORY_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(HISTORY_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [userId]);

  return entries;
};
