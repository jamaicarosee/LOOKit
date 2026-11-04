import React, { createContext, useContext } from 'react';

// Lets the existing nav components (Map / Staff / About) open the Staff Directory
// without threading a new prop through every parent view.
// App.jsx supplies `onOpenStaff`, which checks the login first (guests get the login modal).
const StaffNavContext = createContext({ openStaff: () => {} });

export function StaffNavProvider({ onOpenStaff, children }) {
  return (
    <StaffNavContext.Provider value={{ openStaff: onOpenStaff }}>
      {children}
    </StaffNavContext.Provider>
  );
}

export const useStaffNav = () => useContext(StaffNavContext);
