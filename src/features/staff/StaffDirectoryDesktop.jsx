import React, { useMemo } from 'react';
import StaffList from './components/StaffList';
import { STAFF_DATA, filterStaff } from './data/staffData';

// `split` = a staff member is selected and the map is shown beside the list,
// so the list switches to one narrow column.
<<<<<<< HEAD
<<<<<<< HEAD
export default function StaffDirectoryDesktop({ searchQuery, onSelectStaff, selectedId, split = false }) {
  const visibleStaff = useMemo(() => filterStaff(STAFF_DATA, searchQuery), [searchQuery]);
=======
export default function StaffDirectoryDesktop({ searchQuery, onSelectStaff, selectedId, split = false, staff = STAFF_DATA }) {
  const visibleStaff = useMemo(() => filterStaff(staff, searchQuery), [staff, searchQuery]);
>>>>>>> bc9a15c (admin dashboard improved interface)
=======
export default function StaffDirectoryDesktop({ searchQuery, onSelectStaff, selectedId, split = false, staff = STAFF_DATA }) {
  const visibleStaff = useMemo(() => filterStaff(staff, searchQuery), [staff, searchQuery]);
>>>>>>> fb8d2b8 (updated admin dashboard)

  return (
    <div className="flex-1 min-h-0 w-full overflow-y-auto bg-[#F8F9F9]">
      <div className={split ? 'px-6 py-6' : 'max-w-6xl mx-auto px-8 lg:px-16 py-8'}>
        <p className="text-xl lg:text-2xl font-medium text-[#A8830F] tracking-wide uppercase">
          Pasig Campus
        </p>
        <h1 className="mb-8 text-2xl lg:text-3xl font-black text-[#0B1E36] tracking-tight uppercase">
          Staff Directory
        </h1>

        <StaffList
          staff={visibleStaff}
          onSelectStaff={onSelectStaff}
          selectedId={selectedId}
          gridClassName={
            split
              ? 'grid grid-cols-1 gap-4'
              : 'grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5'
          }
          headingClassName="text-sm lg:text-base"
        />
      </div>
    </div>
  );
}
