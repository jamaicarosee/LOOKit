import React from 'react';
import { MapPin, Search } from 'lucide-react';

export default function DesktopSearchSection({ searchQuery, setSearchQuery, onOpenSearch }) {
  return (
    <section className="w-full bg-white py-4 px-8 shrink-0 z-20">
      <div className="max-w-6xl mx-auto">
        <div className="w-full h-14 bg-[#E5EEF7] rounded-full px-6 flex items-center gap-3 shadow-inner focus-within:ring-2 focus-within:ring-[#0B1E36]/20 transition">
          <MapPin className="w-5 h-5 text-[#475569] shrink-0 stroke-[2]" />

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={onOpenSearch}
            onClick={onOpenSearch}
            placeholder="Search offices, rooms, buildings"
            className="w-full bg-transparent text-sm text-[#0B1E36] placeholder-[#64748B] focus:outline-none font-medium"
          />

          <button
            type="button"
            aria-label="Search"
            onClick={onOpenSearch}
            className="text-[#475569] hover:text-[#0B1E36] transition p-1 shrink-0"
          >
            <Search className="w-5 h-5 stroke-[2]" />
          </button>
        </div>
      </div>
    </section>
  );
}