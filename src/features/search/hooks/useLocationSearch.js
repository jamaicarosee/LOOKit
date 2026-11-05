import { useEffect, useRef, useState, useCallback } from 'react';
import { search } from '../../navigation/services/locationService';

// Debounced search; out-of-order responses are ignored. Empty query returns popular places.
export default function useLocationSearch(query, enabled = true) {
  const [state, setState] = useState({ results: [], isLoading: false, error: null });
  const [retryTick, setRetryTick] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const results = await search(query, { limit: 8 });
        if (id === requestId.current) setState({ results, isLoading: false, error: null });
      } catch (err) {
        if (id === requestId.current) setState({ results: [], isLoading: false, error: err });
      }
    }, query ? 200 : 0);
    return () => clearTimeout(timer);
  }, [query, enabled, retryTick]);

  const retry = useCallback(() => setRetryTick((n) => n + 1), []);
  return { ...state, retry };
}
