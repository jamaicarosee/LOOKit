import React from 'react';
import { MapPin, Search, Sparkles } from 'lucide-react';

// Search box of the Staff page (same look as the dashboard search bars).
// Only logged-in users reach this page, so it is always usable.
// `onAiSearch(text)` (optional) adds the Smart search button; Enter runs it too. Typing still filters live.
export default function StaffSearchBar({ value, onChange, isDesktop = false, onAiSearch, aiLoading = false, onAiClose }) {
  const placeholder = onAiSearch ? 'Search staff, offices, or ask…' : 'Search staff, offices';

  const onKeyDown = (e) => {
    if (!onAiSearch) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      onAiSearch(value);
    } else if (e.key === 'Escape') {
      onAiClose?.();
    }
  };

  const aiButton = onAiSearch && (
    <button
      type="button"
      onClick={() => onAiSearch(value)}
      disabled={aiLoading}
      aria-label="Smart search: ask in plain words"
      title="Smart search: ask in plain words (Enter)"
      className="shrink-0 p-1 text-[#A8830F] hover:text-[#0B2545] transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B2545] rounded-full"
    >
      <Sparkles className={`${isDesktop ? 'w-5 h-5 stroke-[2]' : 'w-4 h-4 stroke-[2.2]'} ${aiLoading ? 'animate-pulse' : ''}`} />
    </button>
  );

  if (isDesktop) {
    return (
      <section className="w-full bg-white py-4 px-8 shrink-0 z-20">
        <div className="max-w-6xl mx-auto">
          <div className="w-full h-14 bg-[#E5EEF7] rounded-full px-6 flex items-center gap-3 shadow-inner focus-within:ring-2 focus-within:ring-[#0B2545]/20 transition">
            <MapPin className="w-5 h-5 text-[#475569] shrink-0 stroke-[2]" />
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              aria-label="Search staff"
              className="w-full bg-transparent text-sm text-[#0B2545] placeholder-[#64748B] focus:outline-none font-medium"
            />
            {aiButton}
            <Search className="w-5 h-5 text-[#475569] shrink-0 stroke-[2]" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="px-5 py-2.5 bg-white shrink-0">
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#E5EEF7] text-[#4A5568] shadow-inner transition-colors focus-within:bg-[#DBE7F3]">
        <MapPin className="w-4 h-4 text-[#4A5568] shrink-0 stroke-[2.2]" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search staff"
          className="w-full bg-transparent text-xs font-medium text-gray-800 placeholder-[#607289] focus:outline-none"
        />
        {aiButton}
        <Search className="w-4 h-4 text-[#4A5568] shrink-0 stroke-[2.2]" />
      </div>
    </div>
  );
}
