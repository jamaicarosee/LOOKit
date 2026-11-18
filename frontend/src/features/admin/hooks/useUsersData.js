import { useCallback, useEffect, useState } from 'react';
import { fetchUsers } from '../data/usersService';

// Loads GET /api/users. Same shape as useStaffData: { users, status, reload }.
// While a new search is loading, the previous rows stay on screen.
export default function useUsersData({ q = '', includeInactive = false } = {}) {
  const [state, setState] = useState({ users: [], status: 'loading' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchUsers({ q, includeInactive })
      .then((users) => !cancelled && setState({ users, status: 'ready' }))
      .catch((err) => {
        console.error('[LOOKit Admin] Could not load users:', err);
        if (!cancelled) setState((s) => ({ ...s, status: 'error' }));
      });
    return () => {
      cancelled = true;
    };
  }, [q, includeInactive, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
