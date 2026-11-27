
import React, { useEffect, useId, useState } from 'react';
import { MapPin, RefreshCw, Search, Sparkles } from 'lucide-react';
import useAiSearch from '../../aiSearch/hooks/useAiSearch';
import AiSearchResults from '../../aiSearch/components/AiSearchResults';
import { resolveStaffLocation } from '../../staff/data/staffLocations';
import { AI_QUERY_MAX } from '../../aiSearch/services/aiSearchService';
import useLocationSearch from '../../search/hooks/useLocationSearch';
import LocationSuggestions from '../../search/components/LocationSuggestions';

export default function SearchBar({
  value,
  onChange,
  onOpenSearch,
  onSelectDestination,
}) {
  const ai = useAiSearch();

  const [navigatingMatch, setNavigatingMatch] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const listboxId = useId();
  const loading = ai.status === 'loading';

  const query = value?.trim() || '';
  const open = showSuggestions && !!query && !loading;

  const {
    results,
    isLoading: searching,
    error,
    retry,
  } = useLocationSearch(query, open);

  useEffect(() => {
    setHighlight(0);
  }, [query, results]);

  const handleChange = (e) => {
    ai.close();
    onChange(e.target.value);
    setShowSuggestions(true);
    setHighlight(0);
  };

  const handlePickLocation = (loc) => {
    setShowSuggestions(false);
    ai.close();
    onChange(loc.name);
    onSelectDestination?.(loc);
  };

  const handleOpenSearch = () => {
    setShowSuggestions(false);
    ai.close();
    onOpenSearch?.();
  };

  const runSmartSearch = (e) => {
    e?.preventDefault();
    setShowSuggestions(false);

    if (!query) {
      onOpenSearch?.();
      return;
    }

    ai.submit(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault();
      setHighlight((h) =>
        Math.min(h + 1, Math.max(results.length - 1, 0))
      );
      return;
    }

    if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();

      if (open && !searching && results[highlight]) {
        handlePickLocation(results[highlight]);
        return;
      }

      if (open && searching) return;

      setShowSuggestions(false);

      if (query) {
        ai.submit(value);
      } else {
        onOpenSearch?.();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      ai.close();
    }
  };

  const handleBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setShowSuggestions(false);
    }
  };

  const handlePickAiMatch = async (match) => {
    if (navigatingMatch) return;

    setNavigatingMatch(true);
    setShowSuggestions(false);

    try {
      let loc = match.category === 'location' ? match.item : null;

      if (match.category === 'staff') {
        try {
          loc = (await resolveStaffLocation(match.item)).loc;
        } catch {
          loc = null;
        }
      }

      if (!loc) {
        ai.showNotice('That office is not on the map yet.');
        return;
      }

      ai.close();
      onSelectDestination?.(loc);
    } finally {
      setNavigatingMatch(false);
    }
  };

  return (
    <div
      className="px-5 py-2.5 bg-white shrink-0 relative z-50"
      onBlurCapture={handleBlur}
    >
      <div className="relative">
        <div className="flex items-center gap-1.5 pl-4 pr-2 py-1.5 rounded-full bg-[#E5EEF7] text-[#4A5568] shadow-inner transition-colors focus-within:bg-[#DBE7F3]">
          <MapPin className="w-4 h-4 text-[#4A5568] shrink-0 stroke-[2.2]" />

          <input
            type="text"
            value={value}
            maxLength={AI_QUERY_MAX}
            onChange={handleChange}
            onFocus={() => {
              if (query && !loading) {
                ai.close();
                setShowSuggestions(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search or ask in plain words"
            aria-label="Search or ask in plain words"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-activedescendant={
              open && results[highlight]
                ? `${listboxId}-opt-${highlight}`
                : undefined
            }
            autoComplete="off"
            className="w-full min-w-0 bg-transparent text-xs font-medium text-gray-800 placeholder-[#607289] focus:outline-none"
          />

          <button
            type="button"
            aria-label="Run smart search"
            onClick={runSmartSearch}
            disabled={loading || navigatingMatch || !query}
            title="Smart search: describe a place or person"
            className="text-[#B48200] hover:text-[#8F6500] hover:bg-[#0B2545]/5 disabled:opacity-40 disabled:cursor-not-allowed rounded-full transition p-2 shrink-0"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin stroke-[2]" />
            ) : (
              <Sparkles className="w-5 h-5 stroke-[2]" />
            )}
          </button>

          <button
            type="button"
            aria-label="Open route search"
            onClick={handleOpenSearch}
            title="Open route search"
            className="text-[#475569] hover:text-[#0B2545] hover:bg-[#0B2545]/5 rounded-full transition p-2 shrink-0"
          >
            <Search className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {open && (
          <LocationSuggestions
            id={listboxId}
            results={results}
            isLoading={searching}
            error={error}
            onRetry={retry}
            query={query}
            highlightedIndex={highlight}
            onPick={handlePickLocation}
            onHover={setHighlight}
          />
        )}
      </div>

      {!open && (
        <AiSearchResults
          search={ai}
          onPick={handlePickAiMatch}
          className="left-5 right-5 top-full mt-1"
        />
      )}
    </div>
  );
}