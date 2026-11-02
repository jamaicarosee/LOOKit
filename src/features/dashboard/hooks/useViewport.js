import { useState, useEffect } from 'react';

export function useViewport(breakpoint = 1024) {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= breakpoint;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${breakpoint}px)`);

    const handleChange = (event) => {
      setIsDesktop(event.matches);
    };

    // Sync initial state
    setIsDesktop(mediaQuery.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [breakpoint]);

  return { isDesktop };
}