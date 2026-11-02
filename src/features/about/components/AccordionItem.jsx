import React from 'react';
import { ChevronDown } from 'lucide-react';

export default function AccordionItem({ id, icon: Icon, title, isOpen, onToggle, last, children }) {
  return (
    <div className={last ? '' : 'border-b border-slate-200'}>
      <button
        type="button"
        id={`about-acc-btn-${id}`}
        aria-expanded={isOpen}
        aria-controls={`about-acc-panel-${id}`}
        onClick={onToggle}
        className="w-full flex items-center gap-3 lg:gap-5 px-4 py-3.5 lg:px-7 lg:py-6 text-left text-[#0B1E36] hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0B1E36]"
      >
        <Icon className="w-4 h-4 lg:w-6 lg:h-6 shrink-0 stroke-[2]" />
        <span className="flex-1 text-sm lg:text-lg font-medium">{title}</span>
        <ChevronDown
          className={`w-4 h-4 lg:w-6 lg:h-6 shrink-0 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        id={`about-acc-panel-${id}`}
        role="region"
        aria-labelledby={`about-acc-btn-${id}`}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 lg:px-7 lg:pb-7 text-xs lg:text-base leading-relaxed text-slate-700">{children}</div>
        </div>
      </div>
    </div>
  );
}
