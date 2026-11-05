import React from 'react';

// Small form pieces shared by the admin tabs. Colors match the rest of the app.
const control =
  'w-full rounded-lg bg-[#E5EEF7] px-3 py-2.5 text-sm font-medium text-[#0B1E36] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#0B1E36]/20 disabled:opacity-60';

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-[#0B1E36]">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props) {
  return <input type="text" {...props} className={control} />;
}

export function SelectInput({ children, ...props }) {
  return (
    <select {...props} className={control}>
      {children}
    </select>
  );
}

export function PrimaryButton({ children, danger = false, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60 ${
        danger ? 'bg-red-700 hover:bg-red-800' : 'bg-[#0B1E36] hover:bg-[#152B47]'
      }`}
    >
      {children}
    </button>
  );
}

export function Notice({ notice }) {
  if (!notice) return null;
  const tone = notice.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800';
  return (
    <p role="status" className={`rounded-lg px-3 py-2 text-xs font-semibold ${tone}`}>
      {notice.text}
    </p>
  );
}

// <option>s for a list of locations, grouped by building
export function LocationOptions({ locations }) {
  const groups = new Map();
  locations.forEach((l) => {
    const key = l.building || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  });
  return [...groups.entries()].map(([building, items]) => (
    <optgroup key={building} label={building}>
      {items.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
          {l.code ? ` (${l.code})` : ''}
        </option>
      ))}
    </optgroup>
  ));
}
