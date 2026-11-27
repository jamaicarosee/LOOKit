
import React, { useEffect, useId, useState } from 'react';
import { MapPin, RefreshCw, Search, Sparkles } from 'lucide-react';
import useAiSearch from '../../../aiSearch/hooks/useAiSearch';
import AiSearchResults from '../../../aiSearch/components/AiSearchResults';
import { resolveStaffLocation } from '../../../staff/data/staffLocations';
import { AI_QUERY_MAX } from '../../../aiSearch/services/aiSearchService';
import useLocationSearch from '../../../search/hooks/useLocationSearch';
import LocationSuggestions from '../../../search/components/LocationSuggestions';

export default function DesktopSearchSection({
  searchQuery,
  setSearchQuery,
  onOpenSearch,
  onSelectDestination,
}) {
  const ai = useAiSearch();

  const [navigatingMatch, setNavigatingMatch] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const listboxId = useId();
  const loading = ai.status === 'loading';

  const query = searchQuery?.trim() || '';
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
    setSearchQuery(e.target.value);
    setShowSuggestions(true);
    setHighlight(0);
  };

  const handlePickLocation = (loc) => {
    setShowSuggestions(false);
    ai.close();
    setSearchQuery(loc.name);
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

    ai.submit(searchQuery);
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
        ai.submit(searchQuery);
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
    <section
      className="relative w-full bg-transparent py-2 px-8 shrink-0 select-none z-50"
      onBlurCapture={handleBlur}
    >
      <div className="max-w-3xl mx-auto relative">
        <div className="w-full h-14 bg-[#E5EEF7] rounded-full pl-6 pr-3 flex items-center gap-2.5 shadow-inner focus-within:ring-2 focus-within:ring-[#0B2545]/20 transition">
          <MapPin className="w-5 h-5 text-[#475569] shrink-0 stroke-[2]" />

          <input
            type="text"
            value={searchQuery}
            maxLength={AI_QUERY_MAX}
            onChange={handleChange}
            onFocus={() => {
              if (query && !loading) {
                ai.close();
                setShowSuggestions(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search offices, rooms, buildings (or ask in plain words)"
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
            className="w-full min-w-0 bg-transparent text-sm text-[#0B2545] placeholder-[#64748B] focus:outline-none font-medium"
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

        {!open && (
          <AiSearchResults
            search={ai}
            onPick={handlePickAiMatch}
          />
        )}
      </div>
    </section>
  );
}