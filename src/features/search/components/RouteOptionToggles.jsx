import React from 'react';
import { Siren, Accessibility } from 'lucide-react';

function ToggleRow({ icon: Icon, label, hint, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-2.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36] rounded-lg"
    >
      <Icon className="w-4 h-4 text-[#0B1E36] stroke-[2.2] shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] font-black text-[#0B2545] leading-tight">{label}</span>
        <span className="block text-[10px] font-medium text-[#607289] leading-tight truncate">{hint}</span>
      </span>
      <span
        className={`relative w-10 h-6 rounded-full shrink-0 transition-colors ${checked ? 'bg-[#0B1E36]' : 'bg-[#C8D3E0]'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`}
        />
      </span>
    </button>
  );
}

// Emergency route and PWD route switches (prototype: below the From / To card)
export default function RouteOptionToggles({ emergency, onEmergencyChange, pwd, onPwdChange }) {
  return (
    <div className="mt-2 px-1">
      <ToggleRow
        icon={Siren}
        label="Emergency route"
        hint="Fastest way to the nearest campus exit"
        checked={emergency}
        onChange={onEmergencyChange}
      />
      <ToggleRow
        icon={Accessibility}
        label="PWD route"
        hint="Ramps and step-free paths, no stairs"
        checked={pwd}
        onChange={onPwdChange}
      />
    </div>
  );
}
