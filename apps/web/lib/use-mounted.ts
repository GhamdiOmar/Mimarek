"use client";

import { useEffect, useState } from "react";

/**
 * Returns `false` on the server render and the first client render, then `true`
 * after the component has mounted on the client.
 *
 * Use this to gate any value that can legitimately differ between the server
 * and the client at render time — e.g. `new Date().getHours()` (the server's
 * wall-clock hour can fall in a different greeting bucket than the user's),
 * `window`/`localStorage` reads, or `Math.random()`. Render a stable, neutral
 * placeholder until `mounted` is `true` so the first client render matches the
 * server HTML and React does not throw a hydration mismatch.
 *
 * @example
 *   const mounted = useMounted();
 *   const greeting = mounted ? greetingForHour(new Date().getHours()) : defaultGreeting;
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
