import { useEffect, useState } from 'react';
import { getRoute } from '../../navigation/services/routingService';

// Runs getRoute whenever `request` changes. status: idle | loading | success | empty | error
export default function useRoute(request) {
  const [state, setState] = useState({ route: null, status: 'idle', error: null });

  useEffect(() => {
    if (!request) return undefined;
    let cancelled = false; // cancels stale requests
    setState((s) => ({ ...s, status: 'loading', error: null }));
    getRoute(request.from, request.to, request.options)
      .then((route) => {
        if (!cancelled) setState({ route, status: route ? 'success' : 'empty', error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ route: null, status: 'error', error });
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  return state;
}
