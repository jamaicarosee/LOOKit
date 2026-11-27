import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../login/context/AuthContext';
import { apiClient } from '../../../services/apiClient';

const MAX_RECENT = 5;

// Entries saved back when "Current Location (GPS)" existed: dropped on load
const isLegacyGps = (loc) => !!loc && (loc.isCurrentLocation || loc.type === 'gps' || loc.id === 'current-location');

function getStorageKey(userId) {
  return userId ? `lookit_recent_routes_${userId}` : null;
}

export default function useRecentSearches() {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || null;

  const [recentRoutes, setRecentRoutes] = useState([]);
  const [dbSearches, setDbSearches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load user-scoped searches from localStorage and backend
  const loadUserSearches = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      setRecentRoutes([]);
      setDbSearches([]);
      return;
    }

    // 1. Read locally scoped cache for instant UI rendering
    const key = getStorageKey(userId);
    if (key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const list = Array.isArray(parsed) ? parsed : [];
          const cleaned = list.filter((r) => !isLegacyGps(r?.from) && !isLegacyGps(r?.to));
          if (cleaned.length !== list.length) localStorage.setItem(key, JSON.stringify(cleaned)); // purge old GPS entries
          setRecentRoutes(cleaned);
        } else {
          setRecentRoutes([]);
        }
      } catch (err) {
        console.error('[LOOKit] Failed to parse local recent searches:', err);
        setRecentRoutes([]);
      }
    }

    // 2. Sync with backend database
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/navigation/recent-searches');
      setDbSearches(res.data?.recent_searches || []);
    } catch (err) {
      console.error('[LOOKit] Failed to fetch recent searches from backend:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isAuthenticated]);

  useEffect(() => {
    loadUserSearches();
  }, [loadUserSearches]);

  // Save a recent route specifically for this user
  const saveRecentRoute = useCallback(
    async (fromLoc, toLoc) => {
      if (!isAuthenticated || !userId || !fromLoc || !toLoc) return;
      if (isLegacyGps(fromLoc) || isLegacyGps(toLoc)) return;

      const sanitizeLoc = (loc) => ({
        id: loc.id,
        code: loc.code,
        name: loc.name,
        fullName: loc.fullName,
        type: loc.type,
        building: loc.building,
        floor: loc.floor,
        coordinates: loc.coordinates,
        coordinate: loc.coordinate,
        geometry: loc.geometry,
      });

      const newRoute = {
        id: `${fromLoc.id || fromLoc.name}>${toLoc.id || toLoc.name}`,
        from: sanitizeLoc(fromLoc),
        to: sanitizeLoc(toLoc),
        timestamp: Date.now(),
      };

      // Update local user-scoped storage
      const key = getStorageKey(userId);
      setRecentRoutes((prev) => {
        const filtered = prev.filter((r) => r.id !== newRoute.id);
        const updated = [newRoute, ...filtered].slice(0, MAX_RECENT);
        if (key) {
          localStorage.setItem(key, JSON.stringify(updated));
        }
        return updated;
      });

      // Persist destination search to backend database
      try {
        await apiClient.post('/api/navigation/recent-searches', {
          location_id: toLoc.id ?? null,
          location_name: toLoc.name,
        });
        const res = await apiClient.get('/api/navigation/recent-searches');
        setDbSearches(res.data?.recent_searches || []);
      } catch (err) {
        console.error('[LOOKit] Failed to persist recent search to database:', err);
      }
    },
    [userId, isAuthenticated]
  );

  // Remove a single entry
  const removeDbSearch = useCallback(async (id) => {
    setDbSearches((prev) => prev.filter((s) => s.id !== id));
    try {
      await apiClient.delete(`/api/navigation/recent-searches/${id}`);
    } catch (err) {
      console.error('[LOOKit] Failed to remove recent search:', err);
    }
  }, []);

  // Clear all entries for this user
  const clearAllSearches = useCallback(async () => {
    if (userId) {
      const key = getStorageKey(userId);
      if (key) localStorage.removeItem(key);
    }
    setRecentRoutes([]);
    setDbSearches([]);

    try {
      await apiClient.delete('/api/navigation/recent-searches/all');
    } catch (err) {
      console.error('[LOOKit] Failed to clear all recent searches:', err);
    }
  }, [userId]);

  return {
    recentRoutes,
    dbSearches,
    isLoading,
    saveRecentRoute,
    removeDbSearch,
    clearAllSearches,
    reloadSearches: loadUserSearches,
  };
}
