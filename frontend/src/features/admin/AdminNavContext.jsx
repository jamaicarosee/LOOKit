import React, { createContext, useContext } from 'react';

// Lets the existing nav components (Map / Staff / About) show an "Admin" button and open
// the admin dashboard without threading props through every parent view.
// `isAdmin` comes from AuthContext (profile.role === 'admin'); the button is UX only,
// real access control is enforced by the backend on every /api/admin/* call.
// `authLoading` lets the nav bars show skeletons until we know whether the Admin button exists.
const AdminNavContext = createContext({ openAdmin: () => {}, isAdmin: false, authLoading: false });

export function AdminNavProvider({ onOpenAdmin, isAdmin, authLoading, children }) {
  return (
    <AdminNavContext.Provider value={{ openAdmin: onOpenAdmin, isAdmin: Boolean(isAdmin), authLoading: Boolean(authLoading) }}>
      {children}
    </AdminNavContext.Provider>
  );
}

export const useAdminNav = () => useContext(AdminNavContext);
