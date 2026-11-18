import { useEffect, useState } from 'react';
import { haversine } from '../../navigation/services/geo';
import { GPS_MIN_MOVE_M, GPS_MIN_INTERVAL_MS, GPS_MAX_ACCURACY_M } from '../../navigation/constants';

const IDLE = { coord: null, accuracy: null, heading: null, status: 'idle', error: null };

// Real-time GPS tracker. While `enabled` it asks for permission and watches the position;
// when disabled the watch is cleared (no background tracking) and the state resets.
//   status: idle | locating | tracking | denied | unavailable
//   coord:  [lng, lat] of the latest accepted fix (same order as the campus GeoJSON)
// Jitter is filtered so the route is not recomputed while the user stands still.
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
    let last = null; // { coord, accuracy, at } of the last accepted fix

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { longitude, latitude, accuracy, heading } = pos.coords;
        const coord = [longitude, latitude];
        const now = Date.now();
        if (last) {
          if (accuracy > GPS_MAX_ACCURACY_M) return;
          if (now - last.at < GPS_MIN_INTERVAL_MS) return;
          const improved = accuracy < last.accuracy * 0.5; // a much better fix is worth showing even without movement
          if (!improved && haversine(last.coord, coord) < GPS_MIN_MOVE_M) return;
        }
        last = { coord, accuracy, at: now };
        setState({ coord, accuracy, heading: Number.isFinite(heading) ? heading : null, status: 'tracking', error: null });
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
                error: err.code === err.TIMEOUT ? 'Couldn’t get a GPS signal. Try again outdoors.' : 'Your location is unavailable right now.',
              },
        );
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return state;
}
