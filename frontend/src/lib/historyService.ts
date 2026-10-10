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
  /** Whether the user has physically installed/implemented this system */
  isImplemented?: boolean;
  implementedAt?: string;
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
  const existingList = listAssessments(entry.userId);
  const existing = existingList.find((item) => item.id === entry.id);
  if (existing?.isImplemented && entry.isImplemented === undefined) {
    entry.isImplemented = existing.isImplemented;
    entry.implementedAt = existing.implementedAt;
  }
  const others = existingList.filter((existingItem) => existingItem.id !== entry.id);
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

export const LAST_ASSESSMENT_KEY = "barkha_last_completed_assessment";

/** Store the most recently completed assessment, available to both guests and members */
export const saveLastCompletedAssessment = (entry: SavedAssessment): boolean => {
  const existing = getLastCompletedAssessment();
  if (existing?.id === entry.id && existing.isImplemented && entry.isImplemented === undefined) {
    entry.isImplemented = existing.isImplemented;
    entry.implementedAt = existing.implementedAt;
  }
  const ok = writeJson(LAST_ASSESSMENT_KEY, entry);
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT, { detail: { lastCompleted: true } }));
  return ok;
};

export const getLastCompletedAssessment = (): SavedAssessment | null =>
  readJson<SavedAssessment | null>(LAST_ASSESSMENT_KEY, null);

export const clearLastCompletedAssessment = () => {
  try {
    localStorage.removeItem(LAST_ASSESSMENT_KEY);
  } catch {
    // Ignore storage errors
  }
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT, { detail: { lastCompleted: true } }));
};

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

/**
 * Update whether a specific assessment has been implemented (physically installed)
 */
export const setAssessmentImplemented = (
  id: string,
  implemented: boolean,
  userId?: string | null,
): boolean => {
  if (userId) {
    const list = listAssessments(userId);
    const existing = list.find((item) => item.id === id);
    if (existing) {
      existing.isImplemented = implemented;
      existing.implementedAt = implemented ? new Date().toISOString() : undefined;
      write(userId, list);
    }
  }

  const last = getLastCompletedAssessment();
  if (last && last.id === id) {
    last.isImplemented = implemented;
    last.implementedAt = implemented ? new Date().toISOString() : undefined;
    saveLastCompletedAssessment(last);
  }

  window.dispatchEvent(new CustomEvent(HISTORY_EVENT, { detail: { id, implemented } }));
  return true;
};

export const isAssessmentImplemented = (id: string, userId?: string | null): boolean => {
  if (userId) {
    const found = getAssessment(userId, id);
    if (found?.isImplemented !== undefined) return !!found.isImplemented;
  }
  const last = getLastCompletedAssessment();
  if (last?.id === id) return !!last.isImplemented;
  return false;
};

/**
 * Returns the latest IMPLEMENTED assessment across account history or guest session.
 * Used for the quick-shortcut on the hero page. Only returns an assessment if isImplemented is true.
 */
export const useLatestImplementedAssessment = (userId?: string | null): SavedAssessment | null => {
  const history = useAssessmentHistory(userId);
  const [lastGuest, setLastGuest] = useState<SavedAssessment | null>(() => getLastCompletedAssessment());

  useEffect(() => {
    const refresh = () => setLastGuest(getLastCompletedAssessment());
    window.addEventListener(HISTORY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(HISTORY_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // First check if there is an implemented assessment in user's history
  const implementedInHistory = history.find((entry) => !!entry.isImplemented);
  if (implementedInHistory) return implementedInHistory;

  // Fallback to last guest assessment IF marked implemented
  if (lastGuest?.isImplemented) return lastGuest;

  return null;
};


