/**
 * "Animate on first visit, never again."
 *
 * A screen entrance is a fade on the whole screen, so replaying it on every
 * navigation dragged the sticky header and tab bar through opacity 0 and read
 * as a flash. The fix was a settle class, and this hook decides when to apply
 * it.
 *
 * Two details are load-bearing:
 *
 * `visited` is read during render but only *written* in an effect. StrictMode
 * double-renders before effects run, so both render passes see the same empty
 * set and the very first screen still animates in development. Writing during
 * render instead would make the second pass see its own write and skip it.
 *
 * The result is frozen in `useState` rather than recomputed each render, or a
 * re-render once the effect has fired would flip the animation off midway
 * through it.
 *
 * It has to be a module-level Set rather than per-component state: navigating
 * away unmounts the screen, so a ref or state inside the component cannot
 * remember that it has already been entered.
 */

import { useEffect, useState } from 'react';

const visited = new Set();

export const useEnterOnce = (key) => {
  const [entering] = useState(() => !visited.has(key));

  useEffect(() => {
    if (entering) visited.add(key);
  }, [entering, key]);

  return entering;
};

export default useEnterOnce;
