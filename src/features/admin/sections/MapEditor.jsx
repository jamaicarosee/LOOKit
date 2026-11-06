import React, { useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import FloorPlanMap from '../components/FloorPlanMap';
import FloorTabs from '../../directions/components/FloorTabs';
import { getAll } from '../../navigation/services/locationService';
import { fetchLocations, renameLocation } from '../../staff/data/staffService';
import { Field, TextInput, PrimaryButton, Notice } from '../components/AdminControls';

const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// Finds the typed/selected database location on the campus map data (by code, then by name)
function findOnMap(from, mapLocations) {
  if (!from) return null;
  const name = norm(from.name);
  return (
    (from.code && mapLocations.find((l) => l.code === from.code)) ||
    mapLocations.find((l) => norm(l.name) === name || norm(l.fullName) === name) ||
    null
  );
}

function placeText(loc) {
  if (loc.type === 'room') return `${loc.building}${loc.floor ? ` · Floor ${loc.floor}` : ''}`;
  return loc.fullName || loc.name;
}

// Map tab: type a location in "From" to see where it is on the campus map,
// then enter its new name in "To" and apply the change.
export default function MapEditor() {
  const [locations, setLocations] = useState([]);
  const [mapLocations, setMapLocations] = useState([]);
  const [fromText, setFromText] = useState('');
  const [fromId, setFromId] = useState('');
  const [open, setOpen] = useState(false);
  const [toName, setToName] = useState('');
  const [activeFloor, setActiveFloor] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchLocations()
      .then((rows) => !cancelled && setLocations(rows))
      .catch((err) => {
        console.error('[LOOKit Admin] Could not load locations:', err);
        if (!cancelled) setNotice({ type: 'error', text: 'Could not load the location list.' });
      });
    getAll()
      .then((rows) => !cancelled && setMapLocations(rows))
      .catch((err) => console.error('[LOOKit Admin] Could not load campus map data:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const from = locations.find((l) => String(l.id) === fromId);
  const onMap = useMemo(() => findOnMap(from, mapLocations), [from, mapLocations]);

  // Show the floor the chosen room is on
  const onMapId = onMap?.id;
  const onMapFloor = onMap?.type === 'room' ? onMap.floor : null;
  useEffect(() => {
    if (onMapFloor) setActiveFloor(onMapFloor);
  }, [onMapId, onMapFloor]);

  const suggestions = useMemo(() => {
    const q = norm(fromText);
    if (!q) return [];
    return locations
      .filter((l) => norm(l.name).includes(q) || norm(l.code).includes(q))
      .sort((a, b) => Number(!norm(a.name).startsWith(q)) - Number(!norm(b.name).startsWith(q)))
      .slice(0, 8);
  }, [fromText, locations]);

  function pick(location) {
    setFromId(String(location.id));
    setFromText(location.name);
    setOpen(false);
    setNotice(null);
  }

  function onFromChange(value) {
    setFromText(value);
    setOpen(true);
    // An exact name counts as chosen; otherwise wait for the admin to pick a suggestion
    const exact = locations.filter((l) => norm(l.name) === norm(value));
    setFromId(exact.length === 1 ? String(exact[0].id) : '');
  }

  function onFromKeyDown(e) {
    if (e.key === 'Enter' && open && suggestions.length > 0) {
      e.preventDefault();
      pick(suggestions[0]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  async function apply() {
    const next = toName.trim();
    if (!from) return setNotice({ type: 'error', text: 'Choose the location to rename from the suggestions.' });
    if (!next) return setNotice({ type: 'error', text: 'Enter the new name.' });
    if (next === from.name) return setNotice({ type: 'error', text: 'The new name is the same as the current one.' });

    setBusy(true);
    setNotice(null);
    try {
      await renameLocation(from.id, next);
      setLocations((list) => list.map((l) => (l.id === from.id ? { ...l, name: next } : l)));
      setFromText(next);
      setNotice({ type: 'success', text: `Renamed "${from.name}" to "${next}".` });
      setToName('');
    } catch (err) {
      console.error('[LOOKit Admin] Rename failed:', err);
      setNotice({ type: 'error', text: err.message || 'Could not rename the location.' });
    } finally {
      setBusy(false);
    }
  }

  let status = 'Type a location in From to see it on the map.';
  if (from && !onMap) status = 'This location is not on the campus map yet.';
  if (from && onMap) status = placeText(onMap);
  if (from && onMap?.type === 'room' && onMap.floor !== activeFloor) status += ` (switch to ${onMap.floor}F to see it)`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] lg:gap-10">
      <section aria-labelledby="map-edit-title" className="space-y-4">
        <h2 id="map-edit-title" className="text-sm font-black text-[#0B1E36]">
          Map
        </h2>

        <Field label="From">
          <div className="relative">
            <TextInput
              role="combobox"
              aria-expanded={open && suggestions.length > 0}
              aria-controls="map-from-list"
              aria-autocomplete="list"
              autoComplete="off"
              value={fromText}
              onChange={(e) => onFromChange(e.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={onFromKeyDown}
              placeholder="Type an office or room"
              disabled={busy}
            />
            {open && suggestions.length > 0 && (
              <ul
                id="map-from-list"
                role="listbox"
                className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200"
              >
                {suggestions.map((l) => (
                  <li key={l.id} role="option" aria-selected={String(l.id) === fromId}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(l);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-[#0B1E36] hover:bg-[#E5EEF7]"
                    >
                      <span className="font-semibold">{l.name}</span>
                      {(l.code || l.building) && (
                        <span className="block text-[11px] text-slate-500">{[l.building, l.code].filter(Boolean).join(' · ')}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>

        <Field label="To">
          <TextInput value={toName} onChange={(e) => setToName(e.target.value)} placeholder="New name" disabled={busy} />
        </Field>
        <PrimaryButton onClick={apply} disabled={busy}>
          {busy ? 'Saving…' : 'Apply change'}
        </PrimaryButton>
        <Notice notice={notice} />
      </section>

      <section aria-labelledby="map-preview-title">
        <div className="mb-2 flex items-center gap-3">
          <h2 id="map-preview-title" className="text-base font-medium text-slate-400">
            Campus map
          </h2>
          <div className="min-w-0 flex-1">
            <FloorTabs activeFloor={activeFloor} routeFloors={[]} onChange={setActiveFloor} />
          </div>
        </div>
        <div className="relative h-[55vh] min-h-[300px] overflow-hidden rounded-xl border border-slate-200 bg-[#E5EBF5] lg:h-[60vh]">
          {/* Floor plan: the chosen room is highlighted and pinned on its floor */}
          <FloorPlanMap target={onMap} activeFloor={activeFloor} />
        </div>
        <p role="status" className="mt-3 flex items-start gap-2 rounded-lg bg-[#E5EEF7] px-3 py-2.5 text-xs font-semibold text-[#0B1E36]">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A017]" />
          <span className="min-w-0">
            {status}
            {onMap?.type === 'room' && <span className="block font-normal text-slate-600">{onMap.fullName || onMap.name}</span>}
          </span>
        </p>
      </section>
    </div>
  );
}