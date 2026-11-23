import { useEffect, useState } from 'react';
import {
  GPS_MIN_MOVE_M,
  GPS_MIN_INTERVAL_MS,
  GPS_MAX_ACCURACY_M,
  GPS_WARMUP_MS,
  GPS_GOOD_ACCURACY_M,
  GPS_QUALITY_GOOD_M,
  GPS_QUALITY_FAIR_M,
  GPS_MAX_SPEED_MPS,
} from '../../navigation/constants';
import { createGpsFilter, quickDistanceM } from '../../navigation/services/gpsFilter';

const IDLE = { coord: null, accuracy: null, heading: null, quality: null, status: 'idle', error: null };

const qualityOf = (accuracy) => (accuracy <= GPS_QUALITY_GOOD_M ? 'good' : accuracy <= GPS_QUALITY_FAIR_M ? 'fair' : 'weak');

// Real-time GPS tracker. While `enabled` it asks for permission and watches the position;
// when disabled the watch is cleared (no background tracking) and the state resets.
//   status:  idle | locating | tracking | denied | unavailable
//   coord:   [lng, lat] of the latest smoothed position (same order as the campus GeoJSON)
//   quality: good | fair | weak   (weak is typical indoors; the UI then offers a manual room pick)
//
// Accuracy work done here:
//   1. Warm-up: the first position is not shown until a good fix arrives or GPS_WARMUP_MS has passed,
//      so a poor first reading no longer becomes the start point.
//   2. Smoothing: fixes are blended with a Kalman filter weighted by reported accuracy.
//   3. Outlier rejection: very inaccurate fixes and "teleport" jumps are ignored.
//   4. Update throttling that scales with accuracy, so the route is not recomputed by noise.
export default function useCurrentLocation(enabled) {
  const [state, setState] = useState(IDLE);

  useEffect(() => {
    if (!enabled) {
      setState(IDLE);
      return undefined;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ ...IDLE, status: 'unavailable', error: 'Location is not supported on this device or browser.' });
      return undefined;
    }

    setState({ ...IDLE, status: 'locating' });

    const filter = createGpsFilter();
    const startedAt = Date.now();
    let published = null; // { coord, accuracy, at } of the last position handed to the UI
    let rawLast = null; // { coord, accuracy, at } of the last accepted raw fix
    let jumpStreak = 0;
    let warmTimer = null;
    let heading = null;

    const publish = (est, now) => {
      published = { coord: est.coord, accuracy: est.accuracy, at: now };
      setState({
        coord: est.coord,
        accuracy: est.accuracy,
        heading,
        quality: qualityOf(est.accuracy),
        status: 'tracking',
        error: null,
      });
    };

    // Warm-up ended with only weak fixes: show the best estimate we have, flagged as weak
    warmTimer = setTimeout(() => {
      if (!published && filter.ready) {
        publish(filter.current(), Date.now());
      }
    }, GPS_WARMUP_MS);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { longitude, latitude, accuracy, heading: h } = pos.coords;
        const coord = [longitude, latitude];
        const now = Date.now();
        heading = Number.isFinite(h) ? h : null;

        // Outlier: hopelessly inaccurate (only enforced once a position is showing)
        if (published && accuracy > GPS_MAX_ACCURACY_M) return;

        // Outlier: implied speed is not human walking and the fix is no better than the previous one
        if (rawLast) {
          const dt = Math.max((now - rawLast.at) / 1000, 0.5);
          const speed = quickDistanceM(rawLast.coord, coord) / dt;
          if (speed > GPS_MAX_SPEED_MPS && accuracy >= rawLast.accuracy * 0.7) {
            jumpStreak += 1;
            if (jumpStreak < 3) return; // three in a row means the user really moved (car, fast ride): accept
            filter.reset();
          }
          jumpStreak = 0;
        }
        rawLast = { coord, accuracy, at: now };

        const est = filter.update(coord, accuracy, now);

        if (!published) {
          // Still warming up: publish as soon as one fix is good, or when the warm-up window is over
          if (accuracy <= GPS_GOOD_ACCURACY_M || now - startedAt >= GPS_WARMUP_MS) publish(est, now);
          return;
        }

        if (now - published.at < GPS_MIN_INTERVAL_MS) return;
        const minMove = Math.max(GPS_MIN_MOVE_M, Math.min(est.accuracy * 0.4, 15)); // noisier -> larger dead-zone
        const improved = est.accuracy < published.accuracy * 0.6; // a much better estimate is worth showing even without movement
        if (!improved && quickDistanceM(published.coord, est.coord) < minMove) return;
        publish(est, now);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({ ...IDLE, status: 'denied', error: 'Location access was blocked. Allow it in your browser settings, or choose a starting point.' });
          return;
        }
        // A hiccup while already tracking keeps the last known position
        setState((s) =>
          s.coord
            ? s
            : {
                ...IDLE,
                status: 'unavailable',
                error: err.code === err.TIMEOUT ? 'Couldn’t get a GPS signal. Try again near a window or outdoors, or choose a starting point.' : 'Your location is unavailable right now.',
              },
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );

    return () => {
      clearTimeout(warmTimer);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled]);

  return state;
}
