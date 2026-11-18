import { LayoutDashboard, Map, Users, Briefcase, ScrollText } from 'lucide-react';

// Tab order: Overview, Map, Directory, Users, Audit Log.
export const ADMIN_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'map', label: 'Map', icon: Map },
  { id: 'staff', label: 'Directory', icon: Briefcase },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
];
