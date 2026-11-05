
import React, { useState } from 'react';
import SearchMobileView from '../search/SearchMobileView';
import DirectionsMobileView from '../directions/DirectionsMobileView';
import useRouteInputs, { saveRecent } from '../search/hooks/useRouteInputs';

export default function NavigationFlow({
  onBackToMap,
  onNavSelect = () => {},
  onProfileClick,
  initialFrom = null,
  initialTo = null,
  isAuthenticated = false,
  requireLogin = () => false,
}) {
  const inputs = useRouteInputs({ initialFrom, initialTo });

  const [screen, setScreen] = useState('search');
  const [request, setRequest] = useState(null);

  const run = (from, to) => {
    setRequest({
      from,
      to,
      options: {
        emergency: inputs.emergency,
        pwd: inputs.pwd,
      },
    });

    setScreen('directions');
  };

  const start = async () => {
    if (!inputs.canNavigate) return;

    // Require login before starting navigation.
    if (!isAuthenticated) {
      requireLogin();
      return;
    }

    const resolved = await inputs.resolvePending();

    if (
      !resolved ||
      (!inputs.emergency && resolved.from.id === resolved.to.id)
    ) {
      return;
    }

    if (!inputs.emergency) {
      saveRecent(resolved.from, resolved.to);
    }

    run(resolved.from, resolved.to);
  };

  const pickDestination = (room) => {
    inputs.selectTo(room);

    if (inputs.emergency) {
      inputs.setEmergency(false);
    }

    if (inputs.from && inputs.from.id !== room.id) {
      if (!isAuthenticated) {
        requireLogin();
        return;
      }

      setRequest({
        from: inputs.from,
        to: room,
        options: {
          emergency: false,
          pwd: inputs.pwd,
        },
      });
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
        isAuthenticated={isAuthenticated}
        requireLogin={requireLogin}
      />
    );
  }

  return (
    <SearchMobileView
      inputs={inputs}
      onBack={onBackToMap}
      onStart={start}
      onNavSelect={onNavSelect}
      onProfileClick={onProfileClick}
    />
  );
}