import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function BackTitleRow({ onBack }) {
  return (
    <div className="flex items-center gap-3 pt-1 pb-3 shrink-0">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="w-10 h-10 rounded-full bg-white border border-gray-200 text-[#0B1E36] flex items-center justify-center shadow-sm active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36]"
      >
        <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
      </button>
      <h2 className="text-lg font-black uppercase tracking-tight text-[#0B2545]">Search</h2>
    </div>
  );
}
