import React, { useEffect, useId, useState } from 'react';
import BackTitleRow from './BackTitleRow';
import RouteInputCard from './RouteInputCard';
import RouteOptionToggles from './RouteOptionToggles';
import LocationSuggestions from './LocationSuggestions';
import StartNavigationButton from './StartNavigationButton';
import useLocationSearch from '../hooks/useLocationSearch';

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

  useEffect(() => setHighlight(0), [results]);

  const pick = (loc) => {
    if (activeField === 'from') inputs.selectFrom(loc);
    else inputs.selectTo(loc);
    setActiveField(null);
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && results[highlight]) {
      e.preventDefault();
      pick(results[highlight]);
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
            results={results}
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
