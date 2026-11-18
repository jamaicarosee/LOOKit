<<<<<<< HEAD
import React, { createContext, useContext } from 'react';
=======
import React, { createContext, useContext, useEffect } from 'react';

// Remembers whether the last signed-in user was an admin, so the nav skeleton can draw
// the right number of tabs before the profile has loaded.
export const ADMIN_HINT_KEY = 'lookit:admin-hint';
>>>>>>> 45883d1 (added skeletal laoding and current loc)

// Lets the existing nav components (Map / Staff / About) show an "Admin" button and open
// the admin dashboard without threading props through every parent view.
// `isAdmin` comes from AuthContext (profile.role === 'admin'); the button is UX only,
// real access control is enforced by the backend on every /api/admin/* call.
// `authLoading` lets the nav bars show skeletons until we know whether the Admin button exists.
const AdminNavContext = createContext({ openAdmin: () => {}, isAdmin: false, authLoading: false });

export function AdminNavProvider({ onOpenAdmin, isAdmin, authLoading, children }) {
<<<<<<< HEAD
=======
  useEffect(() => {
    if (authLoading) return;
    try {
      localStorage.setItem(ADMIN_HINT_KEY, isAdmin ? '1' : '0');
    } catch {
      /* storage unavailable: the skeleton just falls back to 3 tabs */
    }
  }, [authLoading, isAdmin]);

>>>>>>> 45883d1 (added skeletal laoding and current loc)
  return (
    <AdminNavContext.Provider value={{ openAdmin: onOpenAdmin, isAdmin: Boolean(isAdmin), authLoading: Boolean(authLoading) }}>
      {children}
    </AdminNavContext.Provider>
  );
}

<<<<<<< HEAD
export const useAdminNav = () => useContext(AdminNavContext);
=======
export const useAdminNav = () => useContext(AdminNavContext);
>>>>>>> 45883d1 (added skeletal laoding and current loc)
