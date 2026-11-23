import React, { useState } from 'react';
import { RefreshCw, Search, Sparkles } from 'lucide-react';
import AiSearchResults from './AiSearchResults';
import { AI_QUERY_MAX } from '../services/aiSearchService';

// "Ask in plain words" box for the Search screen. Searches only on submit (button / Enter).
export default function AiSearchBox({ search, onPick, onFocus }) {
  const [text, setText] = useState('');
  const loading = search.status === 'loading';

  const onSubmit = (e) => {
    e.preventDefault();
    search.submit(text);
  };

  return (
    <div className="mb-3">
      <div className="relative">
        <form
          onSubmit={onSubmit}
          role="search"
          className="flex items-center gap-2 pl-3.5 pr-1 h-10 rounded-xl bg-[#E5EEF7] focus-within:bg-[#DBE7F3] focus-within:ring-2 focus-within:ring-[#0B2545] transition-colors"
        >
          <Sparkles className="w-4 h-4 text-[#A8830F] stroke-[2.2] shrink-0" aria-hidden="true" />
          <input
            type="text"
            value={text}
            maxLength={AI_QUERY_MAX}
            onChange={(e) => setText(e.target.value)}
            onFocus={onFocus}
            onKeyDown={(e) => e.key === 'Escape' && search.close()}
            placeholder="Ask: registrar on the 2nd floor"
            aria-label="Smart search: ask in plain words"
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent text-xs font-medium text-gray-800 placeholder-[#607289] focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !text.trim()}
            aria-label="Run smart search"
            className="w-8 h-8 shrink-0 rounded-full bg-[#0B2545] text-white flex items-center justify-center active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B2545]"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 stroke-[2.2]" />}
          </button>
        </form>
        <AiSearchResults search={search} onPick={onPick} />
      </div>
      <p className="mt-1 px-1 text-[10px] font-medium text-[#607289]">
        Smart search: describe a place or person, then press Enter.
      </p>
    </div>
  );
}
