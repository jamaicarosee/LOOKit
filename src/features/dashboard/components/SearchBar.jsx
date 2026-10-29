import React from 'react';
import { MapPin, Search } from 'lucide-react';

<<<<<<< HEAD
export default function SearchBar({ value, onChange }) {
=======
export default function SearchBar({ value, onChange, onOpenSearch }) {
>>>>>>> 26db5f2 (added search and directions page)
  return (
    <div className="px-5 py-2.5 bg-white shrink-0">
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#E5EEF7] text-[#4A5568] shadow-inner transition-colors focus-within:bg-[#DBE7F3]">
        <MapPin className="w-4 h-4 text-[#4A5568] shrink-0 stroke-[2.2]" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
<<<<<<< HEAD
=======
          onFocus={onOpenSearch}
          onClick={onOpenSearch}
>>>>>>> 26db5f2 (added search and directions page)
          placeholder="Search offices, rooms, buildings"
          className="w-full bg-transparent text-xs font-medium text-gray-800 placeholder-[#607289] focus:outline-none"
        />
        <Search className="w-4 h-4 text-[#4A5568] shrink-0 stroke-[2.2]" />
      </div>
    </div>
  );
}