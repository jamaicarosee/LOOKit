import { useEffect, useState } from 'react';

// Keeps a loading state on screen for at least `minMs` after the component mounts, so a
// skeleton never just flashes by, and gives up after `maxMs` so a stuck request can never
// trap the user behind placeholders.
//   useMinLoading(true)   -> loading until the caller flips it to false (and 600ms have passed)
//   useMinLoading(false)  -> static screens: skeleton for the minimum time only
export default function useMinLoading(loading, minMs = 600, maxMs = 12000) {
  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const minTimer = setTimeout(() => setMinElapsed(true), minMs);
    const maxTimer = setTimeout(() => setTimedOut(true), maxMs);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, [minMs, maxMs]);

  return (Boolean(loading) && !timedOut) || !minElapsed;
}
