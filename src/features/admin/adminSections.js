import { LayoutDashboard, Map, Users, Briefcase, ScrollText } from 'lucide-react';

<<<<<<< HEAD
export const ADMIN_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'map', label: 'Map Editor', icon: Map },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'staff', label: 'Staff', icon: Briefcase },
=======
// Tab order follows the design: Map and Directory first, the rest after.
export const ADMIN_SECTIONS = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'staff', label: 'Directory', icon: Briefcase },
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
>>>>>>> bc9a15c (admin dashboard improved interface)
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
];
