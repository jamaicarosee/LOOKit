import { useState } from 'react';

export const BUILDING_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'mae', label: 'M.A.E' },
  { id: 'ced', label: 'CED' },
  { id: 'cas', label: 'CAS' },
  { id: 'javier', label: 'Javier' },
  { id: 'canteen', label: 'Canteen' },
];

export function useDashboardState() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeNav, setActiveNav] = useState('map');

  return {
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    activeNav,
    setActiveNav,
  };
}