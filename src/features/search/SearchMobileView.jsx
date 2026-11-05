import React from 'react';
import ScreenShell from '../navigation/ScreenShell';
import { useViewport } from '../dashboard/hooks/useViewport';
import RouteForm from './components/RouteForm';
import { loadRecent } from './hooks/useRouteInputs';

// Search screen: From / To, route toggles and Start Navigation.
// Desktop: full-width frame like the dashboard; phone: single column.
export default function SearchMobileView({ inputs, onBack, onStart, onNavSelect, onProfileClick }) {
  const { isDesktop } = useViewport(1024);
  const recent = loadRecent();

  const recentSection = recent.length > 0 && (
    <section className={isDesktop ? '' : 'mt-6'} aria-label="Recent routes">
      <h3 className="px-1 mb-2 text-[10px] lg:text-xs font-black uppercase tracking-widest text-[#607289]">Recent</h3>
      <ul className="space-y-2">
        {recent.map((r) => (
          <li key={`${r.from.id}>${r.to.id}`}>
            <button
              type="button"
              onClick={() => {
                inputs.selectFrom(r.from);
                inputs.selectTo(r.to);
              }}
              className="w-full text-left px-4 py-2.5 rounded-xl bg-[#E5EEF7] hover:bg-[#D5E2EE] text-xs lg:text-sm font-semibold text-[#0B2545] active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1E36]"
            >
              {r.from.name} → {r.to.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <ScreenShell isDesktop={isDesktop} onNavSelect={onNavSelect} onProfileClick={onProfileClick}>
      {isDesktop ? (
        <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-8 py-6">
          <div className="max-w-6xl mx-auto grid grid-cols-2 gap-10 items-start">
            <RouteForm inputs={inputs} onBack={onBack} onStart={onStart} />
            <div className="pt-14">{recentSection}</div>
          </div>
        </main>
      ) : (
        <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pb-4">
          <RouteForm inputs={inputs} onBack={onBack} onStart={onStart} />
          {/* Recent routes fill the otherwise empty space */}
          {recentSection}
        </main>
      )}
    </ScreenShell>
  );
}
