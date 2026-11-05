<<<<<<< HEAD
import React from 'react';
import SectionPlaceholder from '../components/SectionPlaceholder';

export default function Staff() {
  return <SectionPlaceholder title="Staff" description="Manage staff entries and office links. Coming in a later step." />;
=======
import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import StaffList from '../../staff/components/StaffList';
import useStaffData from '../../staff/hooks/useStaffData';
import {
  addStaff,
  updateStaff,
  deleteStaff,
  fetchDepartments,
  fetchLocations,
} from '../../staff/data/staffService';
import { Field, TextInput, SelectInput, PrimaryButton, Notice, LocationOptions } from '../components/AdminControls';

const ACTIONS = [
  { id: 'update', label: 'Update staff' },
  { id: 'add', label: 'Add staff' },
  { id: 'delete', label: 'Delete staff' },
];

const EMPTY = { employeeNumber: '', firstName: '', lastName: '', role: '', email: '', departmentId: '', officeLocationId: '' };

// Directory tab: update, add or delete staff (Supabase table staff_members),
// next to a live preview of the staff directory.
export default function Staff() {
  const { staff, status, reload } = useStaffData({ fallback: false });
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [menuOpen, setMenuOpen] = useState(true);
  const [action, setAction] = useState(null);
  const [targetId, setTargetId] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchDepartments(), fetchLocations()])
      .then(([d, l]) => {
        if (cancelled) return;
        setDepartments(d);
        setLocations(l);
      })
      .catch((err) => {
        console.error('[LOOKit Admin] Could not load departments/offices:', err);
        if (!cancelled) setNotice({ type: 'error', text: 'Could not load departments and offices.' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const target = staff.find((s) => String(s.id) === targetId);
  const actionLabel = ACTIONS.find((a) => a.id === action)?.label;

  function chooseAction(id) {
    setAction(id);
    setMenuOpen(false);
    setTargetId('');
    setForm(EMPTY);
    setConfirming(false);
    setNotice(null);
  }

  // Picking a person fills the form with their current details
  function pickTarget(id) {
    setTargetId(id);
    setConfirming(false);
    setNotice(null);
    const p = staff.find((s) => String(s.id) === id);
    setForm(
      p
        ? {
            ...EMPTY,
            firstName: p.firstName,
            lastName: p.lastName,
            role: p.position,
            email: p.email,
            departmentId: p.departmentId == null ? '' : String(p.departmentId),
            officeLocationId: p.officeLocationId == null ? '' : String(p.officeLocationId),
          }
        : EMPTY,
    );
  }

  // Clicking a card in the directory preview picks that person
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
      console.error('[LOOKit Admin] Staff change failed:', err);
      setNotice({ type: 'error', text: err.message || 'Something went wrong.' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    const names = { firstName: form.firstName.trim(), lastName: form.lastName.trim() };

    if (action === 'add') {
      if (!names.firstName || !names.lastName) return setNotice({ type: 'error', text: 'Enter a first and last name.' });
      const ok = await run(() => addStaff({ ...form, ...names }), `Added ${names.firstName} ${names.lastName}.`);
      if (ok) setForm(EMPTY);
      return undefined;
    }

    if (!target) return setNotice({ type: 'error', text: 'Choose a staff member first.' });

    if (action === 'delete') {
      if (!confirming) return setConfirming(true);
      setConfirming(false);
      const ok = await run(() => deleteStaff(target.id), `Deleted ${target.name}.`);
      if (ok) pickTarget('');
      return undefined;
    }

    // update: send only what changed
    if (!names.firstName || !names.lastName) return setNotice({ type: 'error', text: 'First and last name cannot be empty.' });
    const next = { ...names, role: form.role.trim(), email: form.email.trim(), departmentId: form.departmentId, officeLocationId: form.officeLocationId };
    const before = {
      firstName: target.firstName,
      lastName: target.lastName,
      role: target.position,
      email: target.email,
      departmentId: target.departmentId == null ? '' : String(target.departmentId),
      officeLocationId: target.officeLocationId == null ? '' : String(target.officeLocationId),
    };
    const patch = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== before[k]));
    if (Object.keys(patch).length === 0) return setNotice({ type: 'error', text: 'Nothing has changed yet.' });
    return run(() => updateStaff(target.id, patch), `Updated ${names.firstName} ${names.lastName}.`);
  }

  const personPicker = (label) => (
    <Field label={label}>
      <SelectInput value={targetId} onChange={(e) => pickTarget(e.target.value)} disabled={busy}>
        <option value="">Select staff</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectInput>
    </Field>
  );

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
        <TextInput value={form.role} onChange={(e) => setField('role', e.target.value)} placeholder="Title" disabled={busy} />
      </Field>
      <Field label="Email">
        <TextInput type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="Email" disabled={busy} />
      </Field>
      <Field label="Department">
        <SelectInput value={form.departmentId} onChange={(e) => setField('departmentId', e.target.value)} disabled={busy}>
          <option value="">Department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Office">
        <SelectInput value={form.officeLocationId} onChange={(e) => setField('officeLocationId', e.target.value)} disabled={busy}>
          <option value="">Office</option>
          <LocationOptions locations={locations} />
        </SelectInput>
      </Field>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] lg:gap-10">
      <section aria-labelledby="dir-title" className="space-y-4">
        <h2 id="dir-title" className="text-sm font-black text-[#0B1E36]">
          Directory
        </h2>

        {/* "What to do?" menu */}
        <div>
          <button
            type="button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-lg bg-[#0B1E36] px-3 py-2.5 text-left text-sm font-bold text-white"
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
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-[#0B1E36]/70 hover:text-[#0B1E36] hover:bg-[#D5E2EE]"
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
            {personPicker('Who will be updated?')}
            {target && (
              <>
                <p className="text-xs font-bold text-[#0B1E36]">What it will be changed into?</p>
                {detailFields}
              </>
            )}
          </>
        )}
        {action === 'add' && detailFields}
        {action === 'delete' && personPicker('Who will be deleted?')}

        {action && (action === 'add' || target) && (
          <PrimaryButton onClick={apply} disabled={busy} danger={action === 'delete' && confirming}>
            {busy
              ? 'Saving…'
              : action === 'add'
                ? 'Add staff'
                : action === 'delete'
                  ? confirming
                    ? `Confirm: delete ${target.name}`
                    : 'Delete staff'
                  : 'Apply change'}
          </PrimaryButton>
        )}
        <Notice notice={notice} />
      </section>

      {/* Live directory preview */}
      <section aria-labelledby="dir-preview" className="min-w-0 rounded-md border border-[#0B1E36] bg-[#F8F9F9]">
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5 lg:px-8">
          <p className="text-base font-medium uppercase tracking-wide text-[#A8830F] lg:text-lg">Pasig Campus</p>
          <h2 id="dir-preview" className="mb-5 text-xl font-black uppercase tracking-tight text-[#0B1E36] lg:text-2xl">
            Staff Directory
          </h2>
          {status === 'loading' && <p className="text-sm text-slate-500">Loading staff…</p>}
          {status === 'error' && (
            <p className="text-sm text-red-700">Could not load staff from Supabase. Check your connection and permissions.</p>
          )}
          {status === 'ready' && (
            <StaffList
              staff={staff}
              onSelectStaff={onCardSelect}
              selectedId={target?.id}
              gridClassName="grid grid-cols-1 gap-3"
              headingClassName="text-xs"
            />
          )}
        </div>
      </section>
    </div>
  );
>>>>>>> bc9a15c (admin dashboard improved interface)
}
