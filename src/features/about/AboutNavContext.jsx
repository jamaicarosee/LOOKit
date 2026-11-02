import React, { createContext, useContext } from 'react';

// Lets the existing nav components (Map / Staff / About) open the About page
// without needing every parent view to thread a new prop through.
const AboutNavContext = createContext({ openAbout: () => {} });

export function AboutNavProvider({ onOpenAbout, children }) {
  return (
    <AboutNavContext.Provider value={{ openAbout: onOpenAbout }}>
      {children}
    </AboutNavContext.Provider>
  );
}

export const useAboutNav = () => useContext(AboutNavContext);
