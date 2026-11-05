import React from 'react';
import { Hammer } from 'lucide-react';

// Temporary body for sections that are built in a later step.
export default function SectionPlaceholder({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E5EEF7] text-[#0B1E36]">
        <Hammer className="h-6 w-6" />
      </span>
      <h2 className="text-base font-bold text-[#0B1E36]">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}
