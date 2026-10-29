import { useCallback, useMemo, useState } from 'react';
import { search } from '../../navigation/services/locationService';

const RECENT_KEY = 'lookit.recentRoutes';

// --- Recent searches (localStorage, always wrapped in try/catch) ---

export function loadRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(raw) ? raw.slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function saveRecent(from, to) {
  if (!from || !to) return;
  try {
    const next = [{ from, to }, ...loadRecent().filter((r) => !(r.from.id === from.id && r.to.id === to.id))].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: recents are optional
  }
}

// From / To state shared by the Search and Directions screens
export default function useRouteInputs({ initialFrom = null, initialTo = null } = {}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [fromText, setFromTextRaw] = useState(initialFrom?.name || '');
  const [toText, setToTextRaw] = useState(initialTo?.name || '');
  const [emergency, setEmergency] = useState(false);
  const [pwd, setPwd] = useState(false);

  // Typing after a selection clears the resolved location
  const setFromText = useCallback((t) => {
    setFromTextRaw(t);
    setFrom(null);
  }, []);
  const setToText = useCallback((t) => {
    setToTextRaw(t);
    setTo(null);
  }, []);

  const selectFrom = useCallback((loc) => {
    setFrom(loc);
    setFromTextRaw(loc ? loc.name : '');
  }, []);
  const selectTo = useCallback((loc) => {
    setTo(loc);
    setToTextRaw(loc ? loc.name : '');
  }, []);

  const swap = useCallback(() => {
    setFrom(to);
    setTo(from);
    setFromTextRaw(toText);
    setToTextRaw(fromText);
  }, [from, to, fromText, toText]);

  const error = useMemo(
    () => (!emergency && from && to && from.id === to.id ? 'Start and destination must be different' : null),
    [emergency, from, to],
  );
  // Typed text counts too: Start Navigation resolves it to the best match
  const canNavigate = (!!from || !!fromText.trim()) && (emergency || !!to || !!toText.trim()) && !error;

  // Turns typed-but-unselected text into locations. Returns { from, to } or null when a side has no match.
  const resolvePending = useCallback(async () => {
    const pick = async (loc, text) => loc || (text.trim() ? (await search(text, { limit: 1 }))[0] || null : null);
    const f = await pick(from, fromText);
    const t = emergency ? to : await pick(to, toText);
    if (!f || (!emergency && !t)) return null;
    if (f !== from) selectFrom(f);
    if (!emergency && t !== to) selectTo(t);
    return { from: f, to: t };
  }, [from, to, fromText, toText, emergency, selectFrom, selectTo]);

  return {
    from, to, fromText, toText,
    setFromText, setToText, selectFrom, selectTo, swap,
    emergency, setEmergency, pwd, setPwd,
    canNavigate, error, resolvePending,
  };
}
