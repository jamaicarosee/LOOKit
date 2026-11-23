import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import StaffList from '../../staff/components/StaffList';
import useStaffData from '../../staff/hooks/useStaffData';
import { STAFF_SECTIONS, normalizeSectionId } from '../../staff/data/staffData';
import {
  addStaff,
  updateStaff,
  deleteStaff,
  fetchDepartments,
  fetchLocations,
  sectionForDepartment,
} from '../../staff/data/staffService';
import { Field, TextInput, SelectInput, PrimaryButton, Notice, LocationOptions } from '../components/AdminControls';
import ConfirmModal from '../components/ConfirmModal';
import { StaffListSkeleton } from '../components/AdminSkeletons';

const ACTIONS = [
  { id: 'update', label: 'Update staff' },
  { id: 'add', label: 'Add staff' },
  { id: 'delete', label: 'Delete staff' },
];

const EMPTY = {
  employeeNumber: '',
  firstName: '',
  lastName: '',
  role: '',
  email: '',
  departmentId: '',
  section: 'offices',
  secondaryRole: '',
  secondaryDepartmentId: '',
  officeLocationId: '',
};

export default function Staff() {
  const { staff, status, reload } = useStaffData({ fallback: false });
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);

  // Set dropdown to closed by default
  const [menuOpen, setMenuOpen] = useState(false);
  const [action, setAction] = useState(null);
  const [targetId, setTargetId] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [hasSecondPosition, setHasSecondPosition] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  // Search state for staff preview list
  const [search, setSearch] = useState('');

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchDepartments(), fetchLocations()]).then(([d, l]) => {
      if (cancelled) return;
      setDepartments(d);
      setLocations(l);
    }).catch(() => {
      if (!cancelled) setNotice({ type: 'error', text: 'Could not load departments and offices.' });
    });
    return () => { cancelled = true; };
  }, []);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // Auto-select the matching Directory Section whenever the primary Department changes
  const handleDepartmentChange = (deptId) => {
    const matched = departments.find((d) => String(d.id) === String(deptId));
    const autoSection = matched ? sectionForDepartment(matched.name) : 'offices';
    setForm((f) => ({ ...f, departmentId: deptId, section: autoSection }));
  };

  const handleToggleSecondPosition = (checked) => {
    setHasSecondPosition(checked);
    if (!checked) {
      setForm((f) => ({ ...f, secondaryRole: '', secondaryDepartmentId: '' }));
    }
  };

  const target = staff.find((s) => String(s.id) === targetId);
  const actionLabel = ACTIONS.find((a) => a.id === action)?.label;

  // Filtered staff list based on search query
  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.position || '').toLowerCase().includes(q) ||
      (s.secondaryPosition || '').toLowerCase().includes(q) ||
      (s.office || '').toLowerCase().includes(q) ||
      (s.secondaryOffice || '').toLowerCase().includes(q) ||
      (s.room_code || '').toLowerCase().includes(q)
    );
  }, [staff, search]);

  function chooseAction(id) {
    setAction(id);
    setMenuOpen(false);
    setTargetId('');
    setForm(EMPTY);
    setHasSecondPosition(false);
    setNotice(null);
  }

  function pickTarget(id) {
    setTargetId(id);
    setNotice(null);
    const p = staff.find((s) => String(s.id) === id);
    if (!p) {
      setForm(EMPTY);
      setHasSecondPosition(false);
      return;
    }
    const resolvedOfficeId = p.officeLocationId ?? p.office_location_id;
    const resolvedSection = normalizeSectionId(p.section || p.groups?.[0] || sectionForDepartment(p.office));
    const secRole = p.secondaryPosition || '';
    const secDeptId = p.secondaryDepartmentId == null ? '' : String(p.secondaryDepartmentId);

    setHasSecondPosition(Boolean(secRole || secDeptId));
    setForm({
      ...EMPTY,
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      role: p.position || '',
      email: p.email || '',
      departmentId: p.departmentId == null ? '' : String(p.departmentId),
      section: resolvedSection,
      secondaryRole: secRole,
      secondaryDepartmentId: secDeptId,
      officeLocationId: resolvedOfficeId == null ? '' : String(resolvedOfficeId),
    });
  }

  const onCardSelect = (person) => {
    if (action === 'update' || action === 'delete') pickTarget(String(person.id));
  };

  async function run(task, doneText) {
    setBusy(true);
    setNotice(null);
    try {
      await task();
      setNotice({ type: 'success', text: doneText });
      reload();
      return true;
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'Something went wrong.' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    const names = {
      firstName: (form.firstName || '').trim(),
      lastName: (form.lastName || '').trim(),
    };

    if (action === 'add') {
      if (!names.firstName || !names.lastName) return setNotice({ type: 'error', text: 'Enter a first and last name.' });
      const payload = {
        ...form,
        ...names,
        secondaryRole: hasSecondPosition ? (form.secondaryRole || '').trim() : '',
        secondaryDepartmentId: hasSecondPosition ? form.secondaryDepartmentId : '',
      };
      run(() => addStaff(payload), `Added ${names.firstName} ${names.lastName}.`).then((ok) => {
        if (ok) {
          setForm(EMPTY);
          setHasSecondPosition(false);
        }
      });
      return;
    }

    if (!target) return setNotice({ type: 'error', text: 'Choose a staff member first.' });

    if (action === 'delete') {
      setConfirmConfig({
        title: 'Delete Staff',
        message: `Are you sure you want to remove ${target.name} from the directory? This action cannot be undone.`,
        isDanger: true,
        confirmAction: async () => {
          const ok = await run(() => deleteStaff(target.id), `Deleted ${target.name}.`);
          if (ok) pickTarget('');
        },
      });
      setConfirmModalOpen(true);
      return;
    }

    if (!names.firstName || !names.lastName) return setNotice({ type: 'error', text: 'First and last name cannot be empty.' });

    setConfirmConfig({
      title: 'Update Staff',
      message: `Are you sure you want to update the details of ${names.firstName} ${names.lastName}?`,
      isDanger: false,
      confirmAction: async () => {
        const next = {
          ...names,
          role: (form.role || '').trim(),
          email: (form.email || '').trim(),
          departmentId: form.departmentId,
          section: form.section,
          secondaryRole: hasSecondPosition ? (form.secondaryRole || '').trim() : '',
          secondaryDepartmentId: hasSecondPosition ? form.secondaryDepartmentId : '',
          officeLocationId: form.officeLocationId,
        };
        const beforeOfficeId = target.officeLocationId ?? target.office_location_id;
        const beforeSection = normalizeSectionId(target.section || target.groups?.[0] || sectionForDepartment(target.office));
        const before = {
          firstName: target.firstName || '',
          lastName: target.lastName || '',
          role: target.position || '',
          email: target.email || '',
          departmentId: target.departmentId == null ? '' : String(target.departmentId),
          section: beforeSection,
          secondaryRole: target.secondaryPosition || '',
          secondaryDepartmentId: target.secondaryDepartmentId == null ? '' : String(target.secondaryDepartmentId),
          officeLocationId: beforeOfficeId == null ? '' : String(beforeOfficeId),
        };
        const patch = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== before[k]));
        if (Object.keys(patch).length === 0) return setNotice({ type: 'error', text: 'Nothing has changed yet.' });
        await run(() => updateStaff(target.id, patch), `Updated ${names.firstName} ${names.lastName}.`);
      },
    });
    setConfirmModalOpen(true);
  }

  const detailFields = (
    <div className="space-y-3">
      {action === 'add' && (
        <Field label="Employee number (optional)">
          <TextInput
            inputMode="numeric"
            value={form.employeeNumber}
            onChange={(e) => setField('employeeNumber', e.target.value.replace(/\D/g, ''))}
            placeholder="Leave blank to assign automatically"
            disabled={busy}
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <TextInput value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} placeholder="First name" disabled={busy} />
        </Field>
        <Field label="Last name">
          <TextInput value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} placeholder="Last name" disabled={busy} />
        </Field>
      </div>
      <Field label="Title">
        <TextInput value={form.role} onChange={(e) => setField('role', e.target.value)} placeholder="e.g. Head - Unit Name" disabled={busy} />
      </Field>
      <Field label="Email">
        <TextInput type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="Email" disabled={busy} />
      </Field>
      <Field label="Department">
        <SelectInput value={form.departmentId} onChange={(e) => handleDepartmentChange(e.target.value)} disabled={busy}>
          <option value="">Department</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </SelectInput>
      </Field>
      <Field label="Directory Section">
        <SelectInput value={form.section} onChange={(e) => setField('section', e.target.value)} disabled={busy}>
          {STAFF_SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </SelectInput>
      </Field>

      {/* Optional Dual Position */}
      <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-[#0B2545] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={hasSecondPosition}
          onChange={(e) => handleToggleSecondPosition(e.target.checked)}
          disabled={busy}
          className="h-4 w-4 rounded border-slate-300 text-[#0B2545] focus:ring-[#0B2545]"
        />
        Other Designation
      </label>

      {hasSecondPosition && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-[#F8F9F9] p-3">
          <Field label="Title">
            <TextInput
              value={form.secondaryRole}
              onChange={(e) => setField('secondaryRole', e.target.value)}
              placeholder="e.g. Faculty - Title"
              disabled={busy}
            />
          </Field>
          <Field label="Department">
            <SelectInput
              value={form.secondaryDepartmentId}
              onChange={(e) => setField('secondaryDepartmentId', e.target.value)}
              disabled={busy}
            >
              <option value="">Department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </SelectInput>
          </Field>
        </div>
      )}

      <Field label="Office">
        <SelectInput value={form.officeLocationId} onChange={(e) => setField('officeLocationId', e.target.value)} disabled={busy}>
          <option value="">Office</option>
          <LocationOptions locations={locations} />
        </SelectInput>
      </Field>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] lg:gap-10">
        <section aria-labelledby="dir-title" className="space-y-4">
          <h2 id="dir-title" className="text-sm font-black text-[#0B2545]">Directory</h2>

          <div>
            <button
              type="button"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-lg bg-[#0B2545] px-3 py-2.5 text-left text-sm font-bold text-white"
            >
              {actionLabel || 'What to do?'}
              <ChevronRight className={`h-4 w-4 transition-transform ${menuOpen ? 'rotate-90' : ''}`} />
            </button>
            {menuOpen && (
              <ul className="rounded-b-lg bg-[#E5EEF7]">
                {ACTIONS.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => chooseAction(a.id)}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-[#0B2545]/70 hover:text-[#0B2545] hover:bg-[#D5E2EE]"
                    >
                      {a.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {action === 'update' && (
            <>
              <Field label="Who will be updated?">
                <SelectInput value={targetId} onChange={(e) => pickTarget(e.target.value)} disabled={busy}>
                  <option value="">Select staff</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </SelectInput>
              </Field>
              {target && <>{detailFields}</>}
            </>
          )}
          {action === 'add' && detailFields}
          {action === 'delete' && (
            <Field label="Who will be deleted?">
              <SelectInput value={targetId} onChange={(e) => pickTarget(e.target.value)} disabled={busy}>
                <option value="">Select staff</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </SelectInput>
            </Field>
          )}

          {action && (action === 'add' || target) && (
            <PrimaryButton onClick={apply} disabled={busy}>
              {busy ? 'Saving…' : action === 'add' ? 'Add staff' : action === 'delete' ? 'Delete staff' : 'Apply change'}
            </PrimaryButton>
          )}
          <Notice notice={notice} />
        </section>

        <section aria-labelledby="dir-preview" className="min-w-0 rounded-md border border-[#0B2545] bg-[#F8F9F9]">
          <div className="max-h-[70vh] overflow-y-auto px-5 py-5 lg:px-8">
            <h2 id="dir-preview" className="mb-4 text-xl font-black uppercase tracking-tight text-[#0B2545] lg:text-2xl">Staff Directory</h2>
<<<<<<< HEAD

=======
            
>>>>>>> 2ff6cf4 (ai search)
            {/* Staff Search Bar matching Users tab style */}
            <div className="mb-5">
              <TextInput
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff by name, title, or office…"
              />
            </div>

            {status === 'loading' && <StaffListSkeleton count={6} />}
            {status === 'error' && <p className="text-sm text-red-700">Could not load staff. Check connection.</p>}
            {status === 'ready' && filteredStaff.length === 0 && (
              <p className="text-sm text-slate-500 py-4">No matching staff members found.</p>
            )}
            {status === 'ready' && filteredStaff.length > 0 && (
              <StaffList
                staff={filteredStaff}
                onSelectStaff={onCardSelect}
                selectedId={target?.id}
                gridClassName="grid grid-cols-1 gap-3"
                headingClassName="text-xs"
              />
            )}
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={confirmModalOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        isDanger={confirmConfig.isDanger}
        onCancel={() => setConfirmModalOpen(false)}
        onConfirm={() => {
          setConfirmModalOpen(false);
          confirmConfig.confirmAction();
        }}
      />
    </>
  );
}