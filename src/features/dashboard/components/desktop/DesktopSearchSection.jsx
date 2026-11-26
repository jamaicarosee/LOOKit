import React, { useState } from 'react';
import { MapPin, RefreshCw, Search } from 'lucide-react';
import useAiSearch from '../../../aiSearch/hooks/useAiSearch';
import AiSearchResults from '../../../aiSearch/components/AiSearchResults';
import { resolveStaffLocation } from '../../../staff/data/staffLocations';
import { AI_QUERY_MAX } from '../../../aiSearch/services/aiSearchService';

export default function DesktopSearchSection({
  searchQuery,
  setSearchQuery,
  onOpenSearch,
  onSelectDestination,
}) {
  const ai = useAiSearch();
  const [navigatingMatch, setNavigatingMatch] = useState(false);
  const loading = ai.status === 'loading';

  const runSmartSearch = (e) => {
    e?.preventDefault();
    if (!searchQuery?.trim()) {
      onOpenSearch?.();
      return;
    }
    ai.submit(searchQuery);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchQuery?.trim()) {
        ai.submit(searchQuery);
      } else {
        onOpenSearch?.();
      }
    } else if (e.key === 'Escape') {
      ai.close();
    }
  };

  const handlePickAiMatch = async (match) => {
    if (navigatingMatch) return;
    setNavigatingMatch(true);
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
    <section className="w-full bg-white py-4 px-8 shrink-0 relative z-50">
      <div className="max-w-3xl mx-auto relative">
        <div className="w-full h-14 bg-[#E5EEF7] rounded-full pl-6 pr-3 flex items-center gap-2.5 shadow-inner focus-within:ring-2 focus-within:ring-[#0B2545]/20 transition">
          <MapPin className="w-5 h-5 text-[#475569] shrink-0 stroke-[2]" />

          <input
            type="text"
            value={searchQuery}
            maxLength={AI_QUERY_MAX}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search offices, rooms, buildings (or ask in plain words)"
            aria-label="Search or ask in plain words"
            autoComplete="off"
            className="w-full bg-transparent text-sm text-[#0B2545] placeholder-[#64748B] focus:outline-none font-medium"
          />

          <button
            type="button"
            aria-label="Open route search"
            onClick={onOpenSearch}
            title="Open route search"
            className="text-[#475569] hover:text-[#0B2545] transition p-2 shrink-0"
          >
            <Search className="w-5 h-5 stroke-[2]" />
          </button>

          <button
            type="button"
            aria-label="Run smart search"
            onClick={runSmartSearch}
            disabled={loading || navigatingMatch || !searchQuery?.trim()}
            title="Smart search: describe a place or person"
            className="h-9 px-3.5 rounded-full bg-[#0B2545] text-white hover:bg-[#16365F] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5 text-xs font-semibold shrink-0"
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Smart</span>
          </button>
        </div>

        <AiSearchResults search={ai} onPick={handlePickAiMatch} />
      </div>
    </section>
  );
}
