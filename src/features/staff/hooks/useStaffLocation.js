import { useEffect, useState } from 'react';
import { resolveStaffLocation } from '../data/staffLocations';

// Looks up where the selected staff member is on the map.
// Returns { status: 'idle' | 'loading' | 'ready' | 'error', result }
export default function useStaffLocation(staff) {
  const [state, setState] = useState({ staffId: null, status: 'idle', result: null });

  useEffect(() => {
    if (!staff) return undefined;
    let cancelled = false;

    resolveStaffLocation(staff)
      .then((result) => {
        if (!cancelled) setState({ staffId: staff.id, status: 'ready', result });
      })
      .catch((err) => {
        console.error('[LOOKit Staff] Could not locate staff member:', err);
        if (!cancelled) setState({ staffId: staff.id, status: 'error', result: null });
      });

    return () => {
      cancelled = true;
    };
  }, [staff]);

  if (!staff) return { status: 'idle', result: null };
  // Still showing the previous person's answer while the new one loads
  if (state.staffId !== staff.id) return { status: 'loading', result: null };
  return { status: state.status, result: state.result };
}
