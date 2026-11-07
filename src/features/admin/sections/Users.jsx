<<<<<<< HEAD
import React from 'react';
import SectionPlaceholder from '../components/SectionPlaceholder';

export default function Users() {
  return <SectionPlaceholder title="Users" description="Search, promote and delete accounts. Coming in a later step." />;
=======
import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import UserCard from '../components/UserCard';
import useUsersData from '../hooks/useUsersData';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { addUser, updateUser, deactivateUser, reactivateUser, errorMessage } from '../data/usersService';
import { Field, TextInput, SelectInput, PrimaryButton, Notice } from '../components/AdminControls';

const ACTIONS = [
  { id: 'update', label: 'Update user' },
  { id: 'add', label: 'Add user' },
  { id: 'delete', label: 'Delete user' },
];

const EMPTY = { fullName: '', email: '', role: 'user', password: '' };
const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const displayName = (u) => u.full_name || u.email;

// Users tab: update, add or delete (deactivate) accounts through the FastAPI /api/users endpoints,
// next to a live, searchable list of users.
export default function Users() {
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim());
  const { users, status, reload } = useUsersData({ q: debouncedSearch, includeInactive: showInactive });
  const [menuOpen, setMenuOpen] = useState(true);
  const [action, setAction] = useState(null);
  const [targetId, setTargetId] = useState('');
  const [targetUser, setTargetUser] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  // Keep the chosen user even when the search box filters them out of the list
  const target = targetId ? users.find((u) => String(u.id) === targetId) || targetUser : null;
  const pickerUsers = target && !users.some((u) => u.id === target.id) ? [target, ...users] : users;
  const actionLabel = ACTIONS.find((a) => a.id === action)?.label;
  const reactivating = action === 'delete' && target && !target.is_active;

  function clearTarget() {
    setTargetId('');
    setTargetUser(null);
    setForm(EMPTY);
    setConfirming(false);
  }

  function chooseAction(id) {
    setAction(id);
    setMenuOpen(false);
    clearTarget();
    setNotice(null);
  }

  // Picking a user fills the form with their current details
  function pickTarget(id) {
    const u = users.find((x) => String(x.id) === id) || null;
    setTargetId(id);
    setTargetUser(u);
    setConfirming(false);
    setNotice(null);
    setForm(u ? { ...EMPTY, fullName: u.full_name || '', email: u.email || '', role: u.role || 'user' } : EMPTY);
  }

  // Clicking a card in the list picks that user
  const onCardSelect = (user) => {
    if (action === 'update' || action === 'delete') pickTarget(String(user.id));
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
      console.error('[LOOKit Admin] User change failed:', err);
      setNotice({ type: 'error', text: errorMessage(err) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    const fullName = form.fullName.trim();
    const email = form.email.trim();
    const fail = (text) => setNotice({ type: 'error', text });

    if (action === 'add') {
      if (!fullName) return fail('Enter a full name.');
      if (!email) return fail('Enter an email address.');
      if (!EMAIL_RE.test(email)) return fail('Enter a valid email address.');
      if (form.password.length < MIN_PASSWORD) return fail(`The temporary password needs at least ${MIN_PASSWORD} characters.`);
      const ok = await run(() => addUser({ fullName, email, role: form.role, password: form.password }), `Added ${fullName}.`);
      if (ok) setForm(EMPTY);
      return undefined;
    }

    if (!target) return fail('Choose a user first.');

    if (action === 'delete') {
      if (!confirming) return setConfirming(true);
      setConfirming(false);
      if (reactivating) {
        const ok = await run(() => reactivateUser(target.id), `Reactivated ${displayName(target)}.`);
        if (ok) clearTarget();
        return undefined;
      }
      const ok = await run(() => deactivateUser(target.id), `Deleted ${displayName(target)}. They now show as Inactive.`);
      if (ok) {
        setShowInactive(true); // so the list shows them as Inactive
        clearTarget();
      }
      return undefined;
    }

    // update: send only what changed
    if (!fullName) return fail('Full name cannot be empty.');
    if (!email) return fail('Email cannot be empty.');
    if (!EMAIL_RE.test(email)) return fail('Enter a valid email address.');
    const next = { fullName, email, role: form.role };
    const before = { fullName: target.full_name || '', email: target.email || '', role: target.role || 'user' };
    const patch = Object.fromEntries(
      Object.entries(next).filter(([k, v]) => (k === 'email' ? v.toLowerCase() !== before.email.toLowerCase() : v !== before[k])),
    );
    if (Object.keys(patch).length === 0) return fail('Nothing has changed yet.');
    return run(() => updateUser(target.id, patch), `Updated ${fullName}.`);
  }

  const userPicker = (label) => (
    <Field label={label}>
      <SelectInput value={targetId} onChange={(e) => pickTarget(e.target.value)} disabled={busy}>
        <option value="">Select user</option>
        {pickerUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {displayName(u)}
            {u.is_active ? '' : ' (inactive)'}
          </option>
        ))}
      </SelectInput>
    </Field>
  );

  const roleField = (
    <Field label="Role">
      <SelectInput value={form.role} onChange={(e) => setField('role', e.target.value)} disabled={busy}>
        <option value="user">user</option>
        <option value="admin">admin</option>
      </SelectInput>
    </Field>
  );

  const detailFields = (
    <div className="space-y-3">
      <Field label="Full name">
        <TextInput value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} placeholder="Full name" disabled={busy} />
      </Field>
      <Field label="Email">
        <TextInput type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="Email" disabled={busy} />
      </Field>
      {roleField}
      {action === 'add' && (
        <Field label="Temporary password">
          <TextInput
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setField('password', e.target.value)}
            placeholder={`At least ${MIN_PASSWORD} characters`}
            disabled={busy}
          />
        </Field>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] lg:gap-10">
      <section aria-labelledby="users-title" className="space-y-4">
        <h2 id="users-title" className="text-sm font-black text-[#0B1E36]">
          Users
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
            {userPicker('Who will be updated?')}
            {target && (
              <>
                <p className="text-xs font-bold text-[#0B1E36]">What it will be changed into?</p>
                {detailFields}
              </>
            )}
          </>
        )}
        {action === 'add' && detailFields}
        {action === 'delete' && (
          <>
            {userPicker('Who will be deleted?')}
            {reactivating && (
              <p className="text-xs text-slate-500">This user is inactive. You can bring the account back by reactivating it.</p>
            )}
          </>
        )}

        {action && (action === 'add' || target) && (
          <PrimaryButton onClick={apply} disabled={busy} danger={action === 'delete' && confirming && !reactivating}>
            {busy
              ? 'Saving…'
              : action === 'add'
                ? 'Add user'
                : action === 'delete'
                  ? reactivating
                    ? confirming
                      ? `Confirm: reactivate ${displayName(target)}`
                      : 'Reactivate user'
                    : confirming
                      ? `Confirm: delete ${displayName(target)}`
                      : 'Delete user'
                  : 'Apply change'}
          </PrimaryButton>
        )}
        <Notice notice={notice} />
      </section>

      {/* Live users list */}
      <section aria-labelledby="users-preview" className="min-w-0 rounded-md border border-[#0B1E36] bg-[#F8F9F9]">
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5 lg:px-8">
          <h2 id="users-preview" className="mb-4 text-xl font-black uppercase tracking-tight text-[#0B1E36] lg:text-2xl">
            Accounts
          </h2>
          <div className="mb-5 space-y-3">
            <TextInput
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              aria-label="Search users"
            />
            <label className="flex w-fit items-center gap-2 text-xs font-semibold text-[#0B1E36]">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 accent-[#0B1E36]"
              />
              Show inactive
            </label>
          </div>
          {status === 'loading' && <p className="text-sm text-slate-500">Loading users…</p>}
          {status === 'error' && <p className="text-sm text-red-700">Could not load users. Check your connection and permissions.</p>}
          {status === 'ready' && users.length === 0 && <p className="text-sm text-slate-500">No users found.</p>}
          {status !== 'loading' && users.length > 0 && (
            <div className="grid grid-cols-1 gap-3 pb-6">
              {users.map((u) => (
                <UserCard key={u.id} user={u} onSelect={onCardSelect} selected={target?.id === u.id} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
>>>>>>> d6a3a47 (updated user, overview, audit logs)
}
