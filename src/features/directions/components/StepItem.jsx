import React from 'react';
import {
  ArrowUp, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, Undo2, Flag, MapPin,
  ChevronsUp, ChevronsDown, Accessibility, DoorOpen,
} from 'lucide-react';

const ICONS = {
  start: MapPin, straight: ArrowUp, left: CornerUpLeft, right: CornerUpRight,
  'slight-left': ArrowUpLeft, 'slight-right': ArrowUpRight, 'sharp-left': CornerUpLeft, 'sharp-right': CornerUpRight,
  'u-turn': Undo2, 'stairs-up': ChevronsUp, 'stairs-down': ChevronsDown, ramp: Accessibility, enter: DoorOpen, arrive: Flag,
};

export default function StepItem({ step, index, active, onSelect, itemRef }) {
  const Icon = ICONS[step.type] || ArrowUp;
  const floorText = step.floorTo ? `${step.floor}F → ${step.floorTo}F` : `${step.floor}F`;
  return (
    <li ref={itemRef}>
      <button
        type="button"
        onClick={() => onSelect(index)}
        aria-current={active ? 'step' : undefined}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36] ${
          active ? 'bg-white ring-2 ring-[#0B1E36] shadow-sm' : 'hover:bg-white/60'
        }`}
      >
        <span className="w-6 h-6 rounded-full bg-[#0B1E36] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <Icon className="w-4 h-4 text-[#4A5568] stroke-[2.2] shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-[#0B2545] leading-snug">{step.instruction}</span>
          <span className="block text-[10px] font-medium text-[#607289]">{floorText}</span>
        </span>
        {step.distanceMeters > 0 && <span className="text-[11px] font-bold text-[#0B1E36] shrink-0">{step.distanceMeters} m</span>}
      </button>
    </li>
  );
}
