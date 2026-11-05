import React from 'react';
import { MapPin, Search } from 'lucide-react';

// Search box of the Staff page (same look as the dashboard search bars).
// Only logged-in users reach this page, so it is always usable.
export default function StaffSearchBar({ value, onChange, isDesktop = false }) {
  const placeholder = 'Search staff, offices';

  if (isDesktop) {
    return (
      <section className="w-full bg-white py-4 px-8 shrink-0 z-20">
        <div className="max-w-6xl mx-auto">
          <div className="w-full h-14 bg-[#E5EEF7] rounded-full px-6 flex items-center gap-3 shadow-inner focus-within:ring-2 focus-within:ring-[#0B1E36]/20 transition">
            <MapPin className="w-5 h-5 text-[#475569] shrink-0 stroke-[2]" />
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              aria-label="Search staff"
              className="w-full bg-transparent text-sm text-[#0B1E36] placeholder-[#64748B] focus:outline-none font-medium"
            />
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
          placeholder={placeholder}
          aria-label="Search staff"
          className="w-full bg-transparent text-xs font-medium text-gray-800 placeholder-[#607289] focus:outline-none"
        />
        <Search className="w-4 h-4 text-[#4A5568] shrink-0 stroke-[2.2]" />
      </div>
    </div>
  );
}
