"use client";

import * as React from "react";

type SessionData = {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
    [key: string]: unknown;
  };
  expires?: string;
  [key: string]: unknown;
} | null;

type SessionContextValue = {
  data: SessionData;
  status: "authenticated" | "unauthenticated" | "loading";
  update: (data?: unknown) => Promise<SessionData>;
};

const SessionContext = React.createContext<SessionContextValue>({
  data: null,
  status: "unauthenticated",
  update: async () => null,
});

/**
 * Lightweight SessionProvider that uses the server-side session directly.
 * Replaces next-auth's SessionProvider to avoid StrictMode double-mount
 * ClientFetchError noise in development.
 *
 * The session is fetched server-side in the dashboard layout and passed
 * as a prop — no client-side /api/auth/session fetch on mount.
 */
export function SimpleSessionProvider({
  session,
  children,
}: {
  session: SessionData;
  children: React.ReactNode;
}) {
  const [currentSession, setCurrentSession] = React.useState<SessionData>(session);

  // Keep session in sync if the prop changes (e.g. after navigation)
  React.useEffect(() => {
    setCurrentSession(session);
  }, [session]);

  const update = React.useCallback(async (data?: unknown) => {
    try {
      const res = await fetch("/api/auth/session", {
        method: data ? "POST" : "GET",
        headers: data ? { "Content-Type": "application/json" } : undefined,
        body: data ? JSON.stringify(data) : undefined,
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentSession(updated);
        return updated;
      }
    } catch {
      // Silently fail — caller can handle
    }
    return currentSession;
  }, [currentSession]);

  const value = React.useMemo<SessionContextValue>(
    () => ({
      data: currentSession,
      status: currentSession ? "authenticated" : "unauthenticated",
      update,
    }),
    [currentSession, update]
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Drop-in replacement for next-auth/react's useSession().
 * Returns { data, status, update } — same shape used across the app.
 */
export function useSession() {
  return React.useContext(SessionContext);
}
