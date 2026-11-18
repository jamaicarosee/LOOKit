<<<<<<< HEAD
import React, { createContext, useContext } from 'react';

// Lets the existing nav components (Map / Staff / About) show an "Admin" button and open
// the admin dashboard without threading props through every parent view.
// `isAdmin` comes from AuthContext (profile.role === 'admin'); the button is UX only,
// real access control is enforced by the backend on every /api/admin/* call.
const AdminNavContext = createContext({ openAdmin: () => {}, isAdmin: false });

export function AdminNavProvider({ onOpenAdmin, isAdmin, children }) {
  return (
    <AdminNavContext.Provider value={{ openAdmin: onOpenAdmin, isAdmin: Boolean(isAdmin) }}>
=======
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
>>>>>>> 73e09d3 (added skeletal loading and current location)
      {children}
    </AdminNavContext.Provider>
  );
}

<<<<<<< HEAD
export const useAdminNav = () => useContext(AdminNavContext);
=======
export const useAdminNav = () => useContext(AdminNavContext);
>>>>>>> 73e09d3 (added skeletal loading and current location)
