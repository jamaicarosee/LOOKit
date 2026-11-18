import { useCallback, useEffect, useState } from 'react';
import { preloadRoutingGraph } from '../../navigation/services/routingService';

// Single source of truth for launch timings (LaunchOverlay reads the fade durations from here too)
export const LAUNCH_TIMING = {
  minSplashMs: 900, // splash never flashes by
  splashFadeMs: 400,
  minSkeletonMs: 700, // skeleton never flashes by either, even if the map is instant
  skeletonFadeMs: 500,
  maxWaitMs: 12000, // safety net: never trap the user behind a loader
};

// Launch phases, in order:
//   splash -> splash-out -> skeleton -> skeleton-out -> done
export function useLaunchSequence() {
  const [phase, setPhase] = useState('splash');
  const [windowLoaded, setWindowLoaded] = useState(
    () => typeof document === 'undefined' || document.readyState === 'complete',
  );
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const [minSkeletonElapsed, setMinSkeletonElapsed] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [graphLoaded, setGraphLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Called by CampusMapPreview once map.on('load') has finished and its GeoJSON layers are painted
  const markMapLoaded = useCallback(() => setMapLoaded(true), []);

  // DOM + initial scripts/assets ready
  useEffect(() => {
    if (windowLoaded) return undefined;
    const onLoad = () => setWindowLoaded(true);
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, [windowLoaded]);

  useEffect(() => {
    const minTimer = setTimeout(() => setMinSplashElapsed(true), LAUNCH_TIMING.minSplashMs);
    const maxTimer = setTimeout(() => setTimedOut(true), LAUNCH_TIMING.maxWaitMs);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, []);

  // Local routing data: warms the campus GeoJSON cache and builds the routing graph
  useEffect(() => {
    let cancelled = false;
    preloadRoutingGraph()
      .catch((err) => {
        // getGraph() clears its cache on failure, so the first real route simply retries
        console.warn('[LOOKit] Routing graph preload failed; it will retry on the first route.', err);
      })
      .finally(() => {
        if (!cancelled) setGraphLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // splash -> splash-out
  useEffect(() => {
    if (phase === 'splash' && minSplashElapsed && (windowLoaded || timedOut)) {
      setPhase('splash-out');
    }
  }, [phase, minSplashElapsed, windowLoaded, timedOut]);

  // splash-out -> skeleton (after the splash fade finishes)
  useEffect(() => {
    if (phase !== 'splash-out') return undefined;
    const t = setTimeout(() => setPhase('skeleton'), LAUNCH_TIMING.splashFadeMs);
    return () => clearTimeout(t);
  }, [phase]);

  // Minimum time the skeleton stays visible
  useEffect(() => {
    if (phase !== 'skeleton') return undefined;
    const t = setTimeout(() => setMinSkeletonElapsed(true), LAUNCH_TIMING.minSkeletonMs);
    return () => clearTimeout(t);
  }, [phase]);

  // skeleton -> skeleton-out: map painted AND routing graph ready (or the safety timeout hit)
  useEffect(() => {
    if (phase === 'skeleton' && minSkeletonElapsed && ((mapLoaded && graphLoaded) || timedOut)) {
      setPhase('skeleton-out');
    }
  }, [phase, minSkeletonElapsed, mapLoaded, graphLoaded, timedOut]);

  // skeleton-out -> done (unmount overlay after the fade)
  useEffect(() => {
    if (phase !== 'skeleton-out') return undefined;
    const t = setTimeout(() => setPhase('done'), LAUNCH_TIMING.skeletonFadeMs);
    return () => clearTimeout(t);
  }, [phase]);

  return { phase, isLaunching: phase !== 'done', markMapLoaded };
}
