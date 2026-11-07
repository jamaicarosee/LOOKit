import { LayoutDashboard, Map, Users, Briefcase, ScrollText } from 'lucide-react';

<<<<<<< HEAD
// Tab order follows the design: Map and Directory first, the rest after.
export const ADMIN_SECTIONS = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'staff', label: 'Directory', icon: Briefcase },
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
=======
// Tab order: Overview, Map, Directory, Users, Audit Log.
export const ADMIN_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'map', label: 'Map', icon: Map },
  { id: 'staff', label: 'Directory', icon: Briefcase },
>>>>>>> d6a3a47 (updated user, overview, audit logs)
  { id: 'users', label: 'Users', icon: Users },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
];
