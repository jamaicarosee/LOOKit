import React from 'react';
import ScreenShell from '../navigation/ScreenShell';
import { useViewport } from '../dashboard/hooks/useViewport';
import RouteForm from './components/RouteForm';
import useRecentSearches from './hooks/useRecentSearches';
import { getById, search } from '../navigation/services/locationService';

export default function SearchMobileView({ inputs, onBack, onStart, onNavSelect, onProfileClick }) {
  const { isDesktop } = useViewport(1024);
  const { recentRoutes, saveRecentRoute } = useRecentSearches();

  const handleStartNavigation = () => {
    if (inputs.from && inputs.to) {
      saveRecentRoute(inputs.from, inputs.to);
    }
    if (onStart) onStart();
  };

  const recentSection = recentRoutes.length > 0 && (
    <section className={isDesktop ? '' : 'mt-6'} aria-label="Recent routes">
      <h3 className="px-1 mb-2 text-[10px] lg:text-xs font-black uppercase tracking-widest text-[#607289]">
        Recent
      </h3>
      <ul className="space-y-2">
        {recentRoutes.map((r) => (
          <li key={r.id || `${r.from.id}>${r.to.id}`}>
            <button
              type="button"
              onClick={async () => {
                const hydrate = async (loc) => {
                  if (!loc) return null;
                  if (loc.type && (loc.building || loc.geometry || loc.coordinates)) return loc;
                  const byId = loc.id ? await getById(loc.id).catch(() => null) : null;
                  if (byId) return byId;
                  const byName = loc.name ? (await search(loc.name, { limit: 1 }).catch(() => []))[0] : null;
                  return byName || loc;
                };

                const [fullFrom, fullTo] = await Promise.all([hydrate(r.from), hydrate(r.to)]);
                inputs.selectFrom(fullFrom);
                inputs.selectTo(fullTo);
              }}
              className="w-full text-left px-4 py-2.5 rounded-xl bg-[#E5EEF7] hover:bg-[#D5E2EE] text-xs lg:text-sm font-semibold text-[#0B2545] active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B2545]"
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
            <RouteForm inputs={inputs} onBack={onBack} onStart={handleStartNavigation} />
            <div className="pt-14">{recentSection}</div>
          </div>
        </main>
      ) : (
        <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pb-4">
          <RouteForm inputs={inputs} onBack={onBack} onStart={handleStartNavigation} />
          {recentSection}
        </main>
      )}
    </ScreenShell>
  );
}