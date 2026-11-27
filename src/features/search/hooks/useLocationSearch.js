
import { useEffect, useRef, useState, useCallback } from 'react';
import { search } from '../../navigation/services/locationService';

export default function useLocationSearch(query, enabled = true) {
  const [state, setState] = useState({
    results: [],
    isLoading: false,
    error: null,
    query: null,
  });

  const [retryTick, setRetryTick] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;

    if (!enabled) {
      setState({
        results: [],
        isLoading: false,
        error: null,
        query: null,
      });
      return;
    }

    setState({
      results: [],
      isLoading: true,
      error: null,
      query,
    });

    const timer = setTimeout(async () => {
      try {
        const results = await search(query, { limit: 8 });

        if (id === requestId.current) {
          setState({
            results,
            isLoading: false,
            error: null,
            query,
          });
        }
      } catch (err) {
        if (id === requestId.current) {
          setState({
            results: [],
            isLoading: false,
            error: err,
            query,
          });
        }
      }
    }, query ? 200 : 0);

    return () => {
      clearTimeout(timer);
      requestId.current += 1;
    };
  }, [query, enabled, retryTick]);

  const retry = useCallback(() => {
    setRetryTick((n) => n + 1);
  }, []);

  const current = enabled && state.query === query;

  return {
    results: current ? state.results : [],
    isLoading: enabled && (!current || state.isLoading),
    error: current ? state.error : null,
    retry,
  };
}