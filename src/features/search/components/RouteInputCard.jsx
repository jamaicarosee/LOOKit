import React from 'react';
import { ArrowUpDown, MapPin, X } from 'lucide-react';
import { COLORS } from '../../navigation/constants';

function Field({ value, onChange, onFocus, onKeyDown, placeholder, label, disabled, onClear, listId, activeId, expanded }) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={label}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        autoComplete="off"
        className="w-full h-10 pl-3.5 pr-9 rounded-xl bg-[#E5EEF7] text-xs font-medium text-gray-800 placeholder-[#607289] focus:bg-[#DBE7F3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
      />
      {value && !disabled && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClear}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="absolute right-1 top-1 w-8 h-8 rounded-full flex items-center justify-center text-[#4A5568] active:scale-95 transition"
        >
          <X className="w-4 h-4 stroke-[2.2]" />
        </button>
      )}
    </div>
  );
}

// From / To inputs with the gold dot -> dotted line -> pin connector and the swap button
export default function RouteInputCard({ inputs, activeField, setActiveField, onKeyDown, highlightedId, listboxId, listOpen }) {
  const { fromText, toText, setFromText, setToText, emergency, selectFrom, selectTo, swap } = inputs;
  const toValue = emergency ? 'Nearest emergency exit (automatic)' : toText;

  return (
    <div className="flex items-center gap-2.5">
      {/* Connector: gold dot, dotted line, pin */}
      <div className="flex flex-col items-center self-stretch py-3.5 shrink-0" aria-hidden="true">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.gold }} />
        <span className="flex-1 border-l-2 border-dotted border-[#9AA8BA] my-1" />
        <MapPin className="w-4 h-4 text-[#0B1E36] stroke-[2.2]" />
      </div>

      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <Field
          value={fromText}
          onChange={setFromText}
          onFocus={() => setActiveField('from')}
          onKeyDown={onKeyDown}
          placeholder="From"
          label="Starting point"
          onClear={() => selectFrom(null)}
          listId={listboxId}
          activeId={activeField === 'from' ? highlightedId : undefined}
          expanded={listOpen && activeField === 'from'}
        />
        <Field
          value={toValue}
          onChange={setToText}
          onFocus={() => setActiveField('to')}
          onKeyDown={onKeyDown}
          placeholder="To"
          label="Destination"
          disabled={emergency}
          onClear={() => selectTo(null)}
          listId={listboxId}
          activeId={activeField === 'to' ? highlightedId : undefined}
          expanded={listOpen && activeField === 'to'}
        />
      </div>

      <button
        type="button"
        onClick={swap}
        disabled={emergency}
        aria-label="Swap start and destination"
        className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-[#0B1E36] active:scale-95 transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36]"
      >
        <ArrowUpDown className="w-4 h-4 stroke-[2.2]" />
      </button>
    </div>
  );
}
