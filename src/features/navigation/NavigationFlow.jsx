import React, { useState } from 'react';
import SearchMobileView from '../search/SearchMobileView';
import DirectionsMobileView from '../directions/DirectionsMobileView';
import useRouteInputs, { saveRecent } from '../search/hooks/useRouteInputs';
import { apiClient } from '../../services/apiClient'; // 1. Import apiClient

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

  const saveToRecentSearchesDatabase = async (destination) => {
    if (!destination) return;
    if (typeof navigator !== 'undefined' && !navigator.online) return;
    try {
      
      const isString = typeof destination === 'string';
      const loc_name = isString 
        ? destination 
        : (destination.name || destination.fullName || 'Selected Location');
      const loc_id = isString 
        ? null 
        : (destination.id || destination.locationid || null);

      await apiClient.post('/api/navigation/recent-searches', {
        location_id: loc_id,
        location_name: loc_name
      });
    } catch (error) {
      console.warn("Background task: Failed to save recent search to database", error);
    }
  };

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

    if (!isAuthenticated) {
      requireLogin();
      return;
    }

    const resolved = await inputs.resolvePending();

    if (!resolved || (!inputs.emergency && resolved.from.id === resolved.to.id)) {
      return;
    }

    if (!inputs.emergency) {
      saveRecent(resolved.from, resolved.to); // Keeps existing local storage logic if needed
      saveToRecentSearchesDatabase(resolved.to); // 3. Wire into the start button flow
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

      saveToRecentSearchesDatabase(room); // 4. Wire into the quick-pick destination flow

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