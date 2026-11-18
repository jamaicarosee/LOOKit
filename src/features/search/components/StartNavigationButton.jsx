import React from 'react';

export default function StartNavigationButton({ disabled, loading, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full h-12 rounded-xl bg-[#0B2545] text-white text-sm font-bold shadow-sm transition active:scale-95 hover:bg-[#141070] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0B2545]"
    >
      {loading ? 'Finding route…' : 'Start Navigation'}
    </button>
  );
}
