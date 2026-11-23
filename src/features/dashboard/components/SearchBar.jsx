import React, { useState } from 'react';
import { MapPin, RefreshCw, Search, Sparkles } from 'lucide-react';
import useAiSearch from '../../aiSearch/hooks/useAiSearch';
import AiSearchResults from '../../aiSearch/components/AiSearchResults';
import { resolveStaffLocation } from '../../staff/data/staffLocations';
import { AI_QUERY_MAX } from '../../aiSearch/services/aiSearchService';

export default function SearchBar({ value, onChange, onOpenSearch, onSelectDestination }) {
  const ai = useAiSearch();
  const [navigatingMatch, setNavigatingMatch] = useState(false);
  const loading = ai.status === 'loading';

  const runSmartSearch = (e) => {
    e?.preventDefault();
    if (!value?.trim()) {
      onOpenSearch?.();
      return;
    }
    ai.submit(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (value?.trim()) {
        ai.submit(value);
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
    <div className="px-5 py-2.5 bg-white shrink-0 relative z-50">
      <div className="flex items-center gap-1.5 pl-4 pr-2 py-1.5 rounded-full bg-[#E5EEF7] text-[#4A5568] shadow-inner transition-colors focus-within:bg-[#DBE7F3]">
        <MapPin className="w-4 h-4 text-[#4A5568] shrink-0 stroke-[2.2]" />
        <input
          type="text"
          value={value}
          maxLength={AI_QUERY_MAX}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search or ask in plain words"
          aria-label="Search or ask in plain words"
          autoComplete="off"
          className="w-full min-w-0 bg-transparent text-xs font-medium text-gray-800 placeholder-[#607289] focus:outline-none"
        />
        <button
          type="button"
          aria-label="Open route search"
          onClick={onOpenSearch}
          className="p-1 text-[#4A5568] hover:text-[#0B2545] shrink-0"
        >
          <Search className="w-4 h-4 stroke-[2.2]" />
        </button>
        <button
          type="button"
          aria-label="Run smart search"
          onClick={runSmartSearch}
          disabled={loading || navigatingMatch || !value?.trim()}
          title="Smart search"
          className="h-7 px-2.5 rounded-full bg-[#0B2545] text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 text-[11px] font-semibold shrink-0 active:scale-95"
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-[#FACC15] stroke-[2.2]" />
          )}
          <span>Smart</span>
        </button>
      </div>

      <AiSearchResults
        search={ai}
        onPick={handlePickAiMatch}
        className="left-5 right-5 top-full mt-1"
      />
    </div>
  );
}