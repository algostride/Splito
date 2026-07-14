/**
 * Light/dark mode, stored under `splito-theme` on <html>.
 *
 * The initial value is read here and also by the inline script in index.html,
 * which sets the attribute before first paint so a dark-mode user never sees a
 * white flash. Both read the same storage key and fall back to the OS
 * preference, so they cannot disagree.
 *
 * Only an explicit toggle writes to storage. Persisting the resolved value on
 * every mount would pin a first-time visitor to whatever their OS happened to
 * report and stop the app following the OS afterwards.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'splito-theme';

const stored = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    // Private browsing modes throw on access rather than returning null.
    return null;
  }
};

const fromSystem = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

export const useTheme = () => {
  // useState takes a *lazy initializer*, so it has to be a thunk that calls
  // these. Passing `stored ?? fromSystem` hands useState the `stored` function
  // itself: React calls it, the `??` never runs, and the state is whatever
  // `stored()` returned — `null` on a first visit. That then wrote the string
  // "null" into data-mode, which matched neither the light nor the dark
  // selector, so the whole palette silently fell through.
  const [mode, setMode] = useState(() => stored() ?? fromSystem());

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Not being able to remember the choice is not worth failing over.
      }
      return next;
    });
  }, []);

  return { mode, toggle };
};

export default useTheme;
