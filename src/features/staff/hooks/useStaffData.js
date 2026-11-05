import { useCallback, useEffect, useState } from 'react';
import { STAFF_DATA } from '../data/staffData';
import { fetchStaff } from '../data/staffService';

// Loads staff from Supabase.
// fallback = true (public Staff page): show the built-in list if the table is empty or fails to load.
// fallback = false (admin): never show the built-in list, because edits only apply to database rows.
export default function useStaffData({ fallback = true } = {}) {
  const initial = fallback ? STAFF_DATA : [];
  const [state, setState] = useState({ staff: initial, status: 'loading' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchStaff()
      .then((rows) => {
        if (cancelled) return;
        setState({ staff: rows.length === 0 && fallback ? STAFF_DATA : rows, status: 'ready' });
      })
      .catch((err) => {
        console.error('[LOOKit Staff] Could not load staff from Supabase:', err);
        if (!cancelled) setState({ staff: fallback ? STAFF_DATA : [], status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [tick, fallback]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
