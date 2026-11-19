import React, { createContext, useContext, useEffect } from 'react';

// Remembers whether the last signed-in user was an admin, so the nav skeleton can draw
// the right number of tabs before the profile has loaded.
export const ADMIN_HINT_KEY = 'lookit:admin-hint';

const AdminNavContext = createContext({ openAdmin: () => {}, isAdmin: false, authLoading: false });

export function AdminNavProvider({ onOpenAdmin, isAdmin, authLoading, children }) {
  useEffect(() => {
    if (authLoading) return;
    try {
      localStorage.setItem(ADMIN_HINT_KEY, isAdmin ? '1' : '0');
    } catch {
      /* storage unavailable: the skeleton just falls back to 3 tabs */
    }
  }, [authLoading, isAdmin]);

  return (
    <AdminNavContext.Provider value={{ openAdmin: onOpenAdmin, isAdmin: Boolean(isAdmin), authLoading: Boolean(authLoading) }}>
      {children}
    </AdminNavContext.Provider>
  );
}

export const useAdminNav = () => useContext(AdminNavContext);
