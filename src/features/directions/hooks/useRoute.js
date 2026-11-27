import { useEffect, useState } from 'react';
import { getRoute } from '../../navigation/services/routingService';

// Runs getRoute whenever `request` changes. status: idle | loading | success | empty | error
export default function useRoute(request) {
  const [state, setState] = useState({ route: null, status: 'idle', error: null });

  useEffect(() => {
    if (!request) return undefined;
    let cancelled = false; // cancels stale requests
    // Live GPS refreshes keep the current route on screen instead of flashing the loading overlay
    setState((s) => (request.live && s.route ? { ...s, error: null } : { ...s, status: 'loading', error: null }));
    getRoute(request.from, request.to, request.options)
      .then((route) => {
        if (!cancelled) setState({ route, status: route ? 'success' : 'empty', error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        // Option A: If user is already viewing a route and a live GPS update fires offline, keep the active route
        if (request.live && error?.code === 'OFFLINE_ROUTE_UNAVAILABLE') {
          setState((s) => (s.route ? s : { route: null, status: 'error', error }));
          return;
        }
        setState({ route: null, status: 'error', error });
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  return state;
}