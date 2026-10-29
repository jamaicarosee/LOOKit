import React, { useState } from 'react';
import SearchMobileView from '../search/SearchMobileView';
import DirectionsMobileView from '../directions/DirectionsMobileView';
import useRouteInputs, { saveRecent } from '../search/hooks/useRouteInputs';

// Search -> Directions flow. Wire into App.jsx without touching existing files:
//
//   <NavigationFlow onBackToMap={() => setScreen('dashboard')} onNavSelect={handleNav} />
//
// Optional: initialTo pre-fills the destination (e.g. from a search bar result).
export default function NavigationFlow({ onBackToMap, onNavSelect = () => {}, onProfileClick, initialFrom = null, initialTo = null }) {
  const inputs = useRouteInputs({ initialFrom, initialTo });
  const [screen, setScreen] = useState('search');
  const [request, setRequest] = useState(null);

  const run = (from, to) => {
    setRequest({ from, to, options: { emergency: inputs.emergency, pwd: inputs.pwd } });
    setScreen('directions');
  };

  const start = async () => {
    if (!inputs.canNavigate) return;
    const resolved = await inputs.resolvePending();
    if (!resolved || (!inputs.emergency && resolved.from.id === resolved.to.id)) return;
    if (!inputs.emergency) saveRecent(resolved.from, resolved.to);
    run(resolved.from, resolved.to);
  };

  // Directory "Go": make that room the destination and re-route
  const pickDestination = (room) => {
    inputs.selectTo(room);
    if (inputs.emergency) inputs.setEmergency(false);
    if (inputs.from && inputs.from.id !== room.id) {
      setRequest({ from: inputs.from, to: room, options: { emergency: false, pwd: inputs.pwd } });
    }
  };

  if (screen === 'directions') {
    return (
      <DirectionsMobileView
        inputs={inputs}
        request={request}
        onBack={() => setScreen('search')}
        onStart={start}
        onPickDestination={pickDestination}
        onNavSelect={onNavSelect}
        onProfileClick={onProfileClick}
      />
    );
  }
  return (
    <SearchMobileView inputs={inputs} onBack={onBackToMap} onStart={start} onNavSelect={onNavSelect} onProfileClick={onProfileClick} />
  );
}
