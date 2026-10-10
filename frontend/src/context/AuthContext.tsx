// Demo authentication: no network calls. A signed-in "session" is a profile
// kept in localStorage, and the user id is derived from the email so signing
// in again with the same address brings back the same saved assessments.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readJson, removeKey, writeJson } from "@/lib/storage";

const SESSION_KEY = "barkha_auth_session";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "homeowner" | "engineer" | "official";
  provider: "google" | "email";
  joinedAt: string;
  state?: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: () => Promise<User>;
  loginWithEmail: (email: string, password: string) => Promise<User>;
  logout: () => void;
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Simulated round trip so the sign-in buttons show their loading state
const MOCK_LATENCY_MS = 700;
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userIdFor = (email: string) => {
  // FNV-1a hash: stable, short and good enough to key local data by email
  let hash = 0x811c9dc5;
  for (const char of email.trim().toLowerCase()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return `u_${(hash >>> 0).toString(36)}`;
};

const nameFromEmail = (email: string) =>
  email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || email;

/** Previously seen profiles, so joinedAt survives signing out and back in. */
const PROFILES_KEY = "barkha_auth_profiles";

const rememberProfile = (user: User): User => {
  const profiles = readJson<Record<string, User>>(PROFILES_KEY, {});
  const existing = profiles[user.id];
  const merged = existing ? { ...user, joinedAt: existing.joinedAt } : user;
  writeJson(PROFILES_KEY, { ...profiles, [user.id]: merged });
  return merged;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => readJson<User | null>(SESSION_KEY, null));
  const [isLoading, setIsLoading] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Keep tabs in sync when the user signs in or out in another tab
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY) setUser(readJson<User | null>(SESSION_KEY, null));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const startSession = useCallback((profile: User) => {
    const saved = rememberProfile(profile);
    writeJson(SESSION_KEY, saved);
    setUser(saved);
    return saved;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true);
    try {
      await wait(MOCK_LATENCY_MS);
      const email = "aditya.sharma@gmail.com";
      return startSession({
        id: userIdFor(email),
        name: "Aditya Sharma",
        email,
        role: "homeowner",
        provider: "google",
        joinedAt: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  }, [startSession]);

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const normalized = email.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(normalized)) throw new Error("invalid-email");
      if (password.length < 6) throw new Error("password-too-short");
      setIsLoading(true);
      try {
        await wait(MOCK_LATENCY_MS);
        return startSession({
          id: userIdFor(normalized),
          name: nameFromEmail(normalized),
          email: normalized,
          role: "homeowner",
          provider: "email",
          joinedAt: new Date().toISOString(),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [startSession],
  );

  // Saved assessments live under the user's id and are kept on sign-out
  const logout = useCallback(() => {
    removeKey(SESSION_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      loginWithGoogle,
      loginWithEmail,
      logout,
      authModalOpen,
      openAuthModal: () => setAuthModalOpen(true),
      closeAuthModal: () => setAuthModalOpen(false),
    }),
    [user, isLoading, loginWithGoogle, loginWithEmail, logout, authModalOpen],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
