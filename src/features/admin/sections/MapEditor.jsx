<<<<<<< HEAD
import React from 'react';
import SectionPlaceholder from '../components/SectionPlaceholder';

export default function MapEditor() {
  return <SectionPlaceholder title="Map Editor" description="Draft, validate and publish map changes. Coming in a later step." />;
=======
import React, { useEffect, useState } from 'react';
import CampusMapPreview from '../../dashboard/components/CampusMapPreview';
import { fetchLocations, renameLocation } from '../../staff/data/staffService';
import { Field, TextInput, SelectInput, PrimaryButton, Notice, LocationOptions } from '../components/AdminControls';

// Map tab: rename a location. From = the current location, To = its new name.
export default function MapEditor({ isDesktop }) {
  const [locations, setLocations] = useState([]);
  const [fromId, setFromId] = useState('');
  const [toName, setToName] = useState('');
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
    return () => {
      cancelled = true;
    };
  }, []);

  const from = locations.find((l) => String(l.id) === fromId);

  async function apply() {
    const next = toName.trim();
    if (!from) return setNotice({ type: 'error', text: 'Choose the location to rename.' });
    if (!next) return setNotice({ type: 'error', text: 'Enter the new name.' });
    if (next === from.name) return setNotice({ type: 'error', text: 'The new name is the same as the current one.' });

    setBusy(true);
    setNotice(null);
    try {
      await renameLocation(from.id, next);
      setLocations((list) => list.map((l) => (l.id === from.id ? { ...l, name: next } : l)));
      setNotice({ type: 'success', text: `Renamed "${from.name}" to "${next}".` });
      setToName('');
    } catch (err) {
      console.error('[LOOKit Admin] Rename failed:', err);
      setNotice({ type: 'error', text: err.message || 'Could not rename the location.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] lg:gap-10">
      <section aria-labelledby="map-edit-title" className="space-y-4">
        <h2 id="map-edit-title" className="text-sm font-black text-[#0B1E36]">
          Map
        </h2>
        <Field label="From">
          <SelectInput value={fromId} onChange={(e) => setFromId(e.target.value)} disabled={busy}>
            <option value="">Current location</option>
            <LocationOptions locations={locations} />
          </SelectInput>
        </Field>
        <Field label="To">
          <TextInput
            value={toName}
            onChange={(e) => setToName(e.target.value)}
            placeholder="New name"
            disabled={busy}
          />
        </Field>
        <PrimaryButton onClick={apply} disabled={busy}>
          {busy ? 'Saving…' : 'Apply change'}
        </PrimaryButton>
        <Notice notice={notice} />
      </section>

      <section aria-labelledby="map-preview-title">
        <h2 id="map-preview-title" className="mb-2 text-base font-medium text-slate-400">
          Campus map
        </h2>
        <div className="relative h-[55vh] min-h-[300px] overflow-hidden rounded-xl border border-slate-200 lg:h-[60vh]">
          <CampusMapPreview activeFilter="all" isDesktop={isDesktop} />
        </div>
      </section>
    </div>
  );
>>>>>>> bc9a15c (admin dashboard improved interface)
}
