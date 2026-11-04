import React from 'react';
import StaffCard from './StaffCard';
import { groupStaffBySection } from '../data/staffData';

/** Staff cards grouped under section headings. Shared by the desktop and mobile screens. */
export default function StaffList({ staff, onSelectStaff, selectedId, gridClassName, headingClassName = '' }) {
  const sections = groupStaffBySection(staff);

  if (sections.length === 0) {
    return <p className="mt-10 text-sm text-slate-500">No staff found.</p>;
  }

  return (
    <div className="space-y-8 pb-10">
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`staff-section-${section.id}`}>
          <h2
            id={`staff-section-${section.id}`}
            className={`mb-4 border-l-4 border-[#D4A017] pl-3 font-extrabold uppercase tracking-wide text-[#0B1E36] ${headingClassName}`}
          >
            {section.title}
            <span className="ml-2 font-semibold text-slate-400">({section.staff.length})</span>
          </h2>
          <div className={gridClassName}>
            {section.staff.map((person) => (
              <StaffCard
                key={person.id}
                staff={person}
                onSelect={onSelectStaff}
                selected={person.id === selectedId}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
