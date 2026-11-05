import React, { useMemo } from 'react';
import StaffList from './components/StaffList';
import { STAFF_DATA, filterStaff } from './data/staffData';

<<<<<<< HEAD
export default function StaffDirectoryMobile({ searchQuery, onSelectStaff, selectedId }) {
  const visibleStaff = useMemo(() => filterStaff(STAFF_DATA, searchQuery), [searchQuery]);
=======
export default function StaffDirectoryMobile({ searchQuery, onSelectStaff, selectedId, staff = STAFF_DATA }) {
  const visibleStaff = useMemo(() => filterStaff(staff, searchQuery), [staff, searchQuery]);
>>>>>>> bc9a15c (admin dashboard improved interface)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#F8F9F9] px-5 py-5">
      <p className="text-sm font-medium uppercase tracking-wide text-[#A8830F]">Pasig Campus</p>
      <h1 className="mb-6 text-xl font-black uppercase tracking-tight text-[#0B1E36]">
        Staff Directory
      </h1>

      <StaffList
        staff={visibleStaff}
        onSelectStaff={onSelectStaff}
        selectedId={selectedId}
        gridClassName="grid grid-cols-1 gap-3"
        headingClassName="text-xs"
      />
    </div>
  );
}
