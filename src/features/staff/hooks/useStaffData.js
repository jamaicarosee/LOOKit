import { useCallback, useEffect, useState } from 'react';
import { STAFF_DATA } from '../data/staffData';
import { apiClient } from '../../../services/apiClient';

export default function useStaffData({ fallback = true } = {}) {
  const initial = fallback ? STAFF_DATA : [];
  const [state, setState] = useState({ staff: initial, status: 'loading' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiClient.get('/api/staff')
      .then((res) => {
        if (cancelled) return;
        const rows = res.data?.staff || [];
        setState({ staff: rows.length === 0 && fallback ? STAFF_DATA : rows, status: 'ready' });
      })
      .catch((err) => {
        console.error('[LOOKit Staff] Could not load staff from FastAPI/Supabase:', err);
        if (!cancelled) setState({ staff: fallback ? STAFF_DATA : [], status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [tick, fallback]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}