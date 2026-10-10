// localStorage can be unavailable (private mode, blocked site data) or full,
// so every access goes through these helpers and degrades to "no data".

export const STORAGE_PREFIX = "barkha_";

export const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

export const writeJson = (key: string, value: unknown): boolean => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Could not save ${key}`, error);
    return false;
  }
};

export const readString = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeString = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Could not save ${key}`, error);
  }
};

export const removeKey = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing stored, nothing to remove
  }
};

/** Every key this app has written to localStorage. */
export const appStorageKeys = (): string[] => {
  try {
    return Object.keys(window.localStorage).filter((key) => key.startsWith(STORAGE_PREFIX));
  } catch {
    return [];
  }
};

/** Save a Blob as a file through a temporary link. */
export const saveBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking immediately can cancel the download in some browsers
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};
