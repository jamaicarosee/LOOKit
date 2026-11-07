import React from 'react';

// Small label used for user roles/status and audit status. Tones reuse the Notice palette.
const TONES = {
  success: 'bg-emerald-50 text-emerald-800',
  error: 'bg-red-50 text-red-800',
  info: 'bg-[#E5EEF7] text-[#0B1E36]',
  muted: 'bg-slate-100 text-slate-500',
};

export default function StatusPill({ tone = 'muted', children }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONES[tone]}`}>
      {children}
    </span>
  );
}
