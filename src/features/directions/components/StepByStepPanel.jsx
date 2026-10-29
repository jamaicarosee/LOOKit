import React, { useEffect, useRef } from 'react';
import StepItem from './StepItem';

// "Step-by-step directions" panel (scrolls internally; the active step stays in view)
export default function StepByStepPanel({ steps, status, activeIndex, onSelect }) {
  const listRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    const list = listRef.current;
    const el = itemRefs.current[activeIndex];
    if (!list || !el) return;
    const top = el.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: top - 8, behavior: 'smooth' });
    }
  }, [activeIndex]);

  return (
    <section aria-label="Step-by-step directions" className="rounded-xl bg-[#E5EBF5] p-3">
      <h3 className="text-sm font-black text-[#0B2545] mb-2">Step-by-step directions</h3>

      {status === 'loading' && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-11 rounded-xl bg-white/70 animate-pulse" />)}
        </div>
      )}
      {status === 'empty' && <p className="text-xs text-[#607289] py-2">No walkable route found between these locations.</p>}
      {(status === 'idle' || status === 'error') && <p className="text-xs text-[#607289] py-2">Directions will appear here.</p>}

      {status === 'success' && steps?.length > 0 && (
        <ol ref={listRef} className="relative max-h-[40dvh] overflow-y-auto no-scrollbar space-y-1">
          {steps.map((s, i) => (
            <StepItem
              key={s.id}
              step={s}
              index={i}
              active={i === activeIndex}
              onSelect={onSelect}
              itemRef={(el) => { itemRefs.current[i] = el; }}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
