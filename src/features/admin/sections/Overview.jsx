import React from 'react';
<<<<<<< HEAD
import SectionPlaceholder from '../components/SectionPlaceholder';

export default function Overview() {
  return <SectionPlaceholder title="Overview" description="Counts for users, rooms, buildings and staff arrive in a later step." />;
=======
import { ChevronRight } from 'lucide-react';
import CampusMapPreview from '../../dashboard/components/CampusMapPreview';
import StaffList from '../../staff/components/StaffList';
import useStaffData from '../../staff/hooks/useStaffData';
import useUsersData from '../hooks/useUsersData';
import PanelBoundary from '../components/PanelBoundary';
import StatusPill from '../components/StatusPill';

const STAFF_PREVIEW_COUNT = 8;

function Panel({ id, title, onView, children }) {
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-md border border-[#0B1E36] bg-[#F8F9F9]">
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 id={id} className="text-sm font-black text-[#0B1E36]">
          {title}
        </h2>
        <button type="button" onClick={onView} className="flex items-center gap-1 text-xs font-bold text-[#0B1E36] hover:underline">
          View
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

const loadingText = (text) => <p className="text-sm text-slate-500">{text}</p>;
const errorText = (text) => <p className="text-sm text-red-700">{text}</p>;

// Overview tab: three read-only panels (map, directory, users), each with its own
// loading/error state and a "View" link to the full tab.
export default function Overview({ onNavigate }) {
  const { staff, status: staffStatus } = useStaffData({ fallback: false });
  const { users, status: usersStatus } = useUsersData({ includeInactive: true });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Panel id="ov-map" title="Map" onView={() => onNavigate?.('map')}>
        <div className="relative h-72 overflow-hidden rounded-xl border border-slate-200 bg-[#E5EBF5]">
          <PanelBoundary fallback={<p className="p-4 text-sm text-red-700">Could not show the campus map.</p>}>
            {/* Sized for a small panel, so it uses the phone zoom level */}
            <CampusMapPreview activeFilter="all" isDesktop={false} />
          </PanelBoundary>
        </div>
      </Panel>

      <Panel id="ov-staff" title="Directory" onView={() => onNavigate?.('staff')}>
        <div className="max-h-72 overflow-y-auto">
          {staffStatus === 'loading' && loadingText('Loading staff…')}
          {staffStatus === 'error' && errorText('Could not load staff. Check your connection and permissions.')}
          {staffStatus === 'ready' && (
            <StaffList staff={staff.slice(0, STAFF_PREVIEW_COUNT)} gridClassName="grid grid-cols-1 gap-3" headingClassName="text-xs" />
          )}
        </div>
      </Panel>

      <Panel id="ov-users" title="Users" onView={() => onNavigate?.('users')}>
        <div className="max-h-72 overflow-y-auto">
          {usersStatus === 'loading' && loadingText('Loading users…')}
          {usersStatus === 'error' && errorText('Could not load users. Check your connection and permissions.')}
          {usersStatus === 'ready' && users.length === 0 && loadingText('No users found.')}
          {usersStatus === 'ready' && users.length > 0 && (
            <ul className="space-y-2">
              {users.map((u) => (
                <li key={u.id} className={`rounded-xl bg-white px-3 py-2 shadow-sm ${u.is_active ? '' : 'opacity-70'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-extrabold text-[#0B1E36]">{u.full_name || u.email}</p>
                    <div className="flex shrink-0 gap-1.5">
                      <StatusPill tone="info">{u.role}</StatusPill>
                      <StatusPill tone={u.is_active ? 'success' : 'muted'}>{u.is_active ? 'Active' : 'Inactive'}</StatusPill>
                    </div>
                  </div>
                  <p className="truncate text-xs text-slate-400">{u.email}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
>>>>>>> d6a3a47 (updated user, overview, audit logs)
}
