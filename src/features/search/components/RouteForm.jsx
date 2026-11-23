import React, { useEffect, useId, useMemo, useState } from 'react';
import BackTitleRow from './BackTitleRow';
import RouteInputCard from './RouteInputCard';
import RouteOptionToggles from './RouteOptionToggles';
import LocationSuggestions from './LocationSuggestions';
import StartNavigationButton from './StartNavigationButton';
import GpsAssist from './GpsAssist';
import useLocationSearch from '../hooks/useLocationSearch';
import { CURRENT_LOCATION } from '../../navigation/services/locationService';

// "Current Location" is offered for an empty From field and for queries like "cur", "my loc", "gps"
const CURRENT_WORDS = ['current', 'location', 'gps', 'my'];
const matchesCurrentLocation = (q) => {
  const t = q.trim().toLowerCase();
  return !t || CURRENT_WORDS.some((w) => w.startsWith(t));
};

// Title row + From/To card + route toggles + suggestions + Start Navigation (shared by both screens)
export default function RouteForm({ inputs, onBack, onStart, isLoading = false }) {
  const [activeField, setActiveField] = useState(null);
  const [highlight, setHighlight] = useState(0);
  const listboxId = useId();

  const query = activeField === 'from' ? inputs.fromText : activeField === 'to' ? inputs.toText : '';
  const resolved = activeField === 'from' ? inputs.from : activeField === 'to' ? inputs.to : null;
  const enabled = activeField !== null && !(activeField === 'to' && inputs.emergency);
  const { results, isLoading: searching, error, retry } = useLocationSearch(resolved ? '' : query, enabled);
  const open = enabled && !resolved;

  // Current Location is pinned at the top of the From suggestions (and takes part in arrow-key navigation)
  const options = useMemo(
    () => (activeField === 'from' && matchesCurrentLocation(query) ? [CURRENT_LOCATION, ...results] : results),
    [activeField, query, results],
  );

  useEffect(() => setHighlight(0), [options]);

  const pick = (loc) => {
    if (loc.isCurrentLocation) inputs.selectCurrentLocation();
    else if (activeField === 'from') inputs.selectFrom(loc);
    else inputs.selectTo(loc);
    setActiveField(null);
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && options[highlight]) {
      e.preventDefault();
      pick(options[highlight]);
    } else if (e.key === 'Escape') {
      setActiveField(null);
      e.target.blur();
    }
  };

  // Close the list when focus leaves the card (clicks inside the list keep focus via preventDefault)
  const onBlurCapture = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setActiveField(null);
  };

  return (
    <div onBlurCapture={onBlurCapture}>
      <BackTitleRow onBack={onBack} />

      <div className="relative">
        <RouteInputCard
          inputs={inputs}
          activeField={activeField}
          setActiveField={setActiveField}
          onKeyDown={onKeyDown}
          highlightedId={`${listboxId}-opt-${highlight}`}
          listboxId={listboxId}
          listOpen={open}
        />
        {open && (
          <LocationSuggestions
            id={listboxId}
            results={options}
            isLoading={searching}
            error={error}
            onRetry={retry}
            query={query}
            highlightedIndex={highlight}
            onPick={pick}
            onHover={setHighlight}
          />
        )}
      </div>

      {inputs.error && (
        <p role="alert" className="mt-2 px-1 text-[11px] font-semibold text-red-600">
          {inputs.error}
        </p>
      )}

      {inputs.from?.isCurrentLocation && <GpsAssist inputs={inputs} />}
      {inputs.gpsError && (
        <p role="alert" className="mt-2 px-1 text-[11px] font-semibold text-red-600">
          {inputs.gpsError}
        </p>
      )}

      <RouteOptionToggles
        emergency={inputs.emergency}
        onEmergencyChange={inputs.setEmergency}
        pwd={inputs.pwd}
        onPwdChange={inputs.setPwd}
      />

      <div className="mt-3">
        <StartNavigationButton disabled={!inputs.canNavigate} loading={isLoading} onClick={onStart} />
      </div>
    </div>
  );
}
