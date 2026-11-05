import { LayoutDashboard, Map, Users, Briefcase, ScrollText } from 'lucide-react';

export const ADMIN_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'map', label: 'Map Editor', icon: Map },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'staff', label: 'Staff', icon: Briefcase },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
];
