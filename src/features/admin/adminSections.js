import { LayoutDashboard, Map, Users, Briefcase, ScrollText } from 'lucide-react';

// Tab order follows the design: Map and Directory first, the rest after.
export const ADMIN_SECTIONS = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'staff', label: 'Directory', icon: Briefcase },
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
];
