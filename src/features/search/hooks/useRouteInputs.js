import { useCallback, useEffect, useMemo, useState } from 'react';
import { search, CURRENT_LOCATION, makeLiveLocation } from '../../navigation/services/locationService';
import useCurrentLocation from './useCurrentLocation';

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
  if (!from || !to || from.isCurrentLocation) return; // a live GPS start is not a place worth repeating
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
  const [gpsError, setGpsError] = useState(null);
  // GPS cannot detect floors, so the user says which floor they are on (used only with Current Location)
  const [gpsFloor, setGpsFloor] = useState(1);

  // Real-time GPS runs only while "Current Location" is the starting point
  const gps = useCurrentLocation(!!from?.isCurrentLocation);
  // `from` stays the stable "Current Location (GPS)" entry; `liveFrom` is the same entry carrying the
  // latest coordinates and is what the routing engine receives. null until the first fix arrives.
  const liveFrom = useMemo(() => {
    if (!from?.isCurrentLocation) return from;
    return gps.coord ? makeLiveLocation({ ...gps, floor: gpsFloor }) : null;
  }, [from, gps, gpsFloor]);

  // GPS failed (permission denied, no signal): drop the placeholder so a start can be picked by hand
  useEffect(() => {
    if (!gps.error) return;
    setGpsError(gps.error);
    setFrom((f) => (f?.isCurrentLocation ? null : f));
    setFromTextRaw((t) => (t === CURRENT_LOCATION.name ? '' : t));
  }, [gps.error]);

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
    setGpsError(null);
    setFrom(loc);
    setFromTextRaw(loc ? loc.name : '');
  }, []);
  // Starts GPS tracking (the browser asks for permission) and shows the live label in the From field
  const selectCurrentLocation = useCallback(() => {
    setGpsError(null);
    setGpsFloor(1);
    setFrom(CURRENT_LOCATION);
    setFromTextRaw(CURRENT_LOCATION.name);
  }, []);
  const selectTo = useCallback((loc) => {
    setTo(loc);
    setToTextRaw(loc ? loc.name : '');
  }, []);

  const swap = useCallback(() => {
    if (from?.isCurrentLocation) return; // the live GPS position can only be a start
    setFrom(to);
    setTo(from);
    setFromTextRaw(toText);
    setToTextRaw(fromText);
  }, [from, to, fromText, toText]);

  const error = useMemo(
    () => (!emergency && from && to && from.id === to.id ? 'Start and destination must be different' : null),
    [emergency, from, to],
  );
  // Typed text counts too: Start Navigation resolves it to the best match.
  // With Current Location it also waits for the first GPS fix.
  const waitingForFix = !!from?.isCurrentLocation && !gps.coord;
  const canNavigate = (!!from || !!fromText.trim()) && (emergency || !!to || !!toText.trim()) && !error && !waitingForFix;

  // Turns typed-but-unselected text into locations. Returns { from, to } or null when a side has no match.
  const resolvePending = useCallback(async () => {
    const pick = async (loc, text) => loc || (text.trim() ? (await search(text, { limit: 1 }))[0] || null : null);
    const f = await pick(from, fromText);
    const t = emergency ? to : await pick(to, toText);
    if (!f || (!emergency && !t)) return null;
    if (f !== from) selectFrom(f);
    if (!emergency && t !== to) selectTo(t);
    // A GPS start goes to the router with its live coordinates
    return { from: f === from ? liveFrom : f, to: t };
  }, [from, to, fromText, toText, emergency, liveFrom, selectFrom, selectTo]);

  return {
    from, to, fromText, toText,
    setFromText, setToText, selectFrom, selectTo, swap,
    selectCurrentLocation, liveFrom, gps, gpsError, gpsFloor, setGpsFloor,
    emergency, setEmergency, pwd, setPwd,
    canNavigate, error, resolvePending,
  };
}
