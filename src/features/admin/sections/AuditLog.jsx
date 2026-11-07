<<<<<<< HEAD
import React from 'react';
import SectionPlaceholder from '../components/SectionPlaceholder';

export default function AuditLog() {
  return <SectionPlaceholder title="Audit Log" description="Every admin action will be listed here. Coming in a later step." />;
=======
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAudit } from '../data/auditService';
import { errorMessage } from '../data/usersService';
import useDebouncedValue from '../hooks/useDebouncedValue';
import StatusPill from '../components/StatusPill';
import { Field, TextInput, SelectInput, PrimaryButton, Notice } from '../components/AdminControls';

const PAGE_SIZE = 25;
const EMPTY_FILTERS = { q: '', action: '', entityType: '', status: '', dateFrom: '', dateTo: '' };

const humanize = (s = '') => {
  const t = String(s).replace(/[_-]+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
};
const isFailed = (status) => /fail|error/i.test(status || '');

function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso || '', time: '' };
  return {
    date: d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

function formatValue(field, value) {
  if (/password/i.test(field)) return '••••••';
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

// Turns the entry's `changes` into [{ field, before, after }]. Expects { field: { before, after } }
// and also copes with { before: {...}, after: {...} } and { field: [before, after] }.
function describeChanges(changes) {
  if (!changes || typeof changes !== 'object') return [];
  const isMap = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (isMap(changes.before) && isMap(changes.after)) {
    const keys = [...new Set([...Object.keys(changes.before), ...Object.keys(changes.after)])];
    return keys
      .filter((k) => JSON.stringify(changes.before[k]) !== JSON.stringify(changes.after[k]))
      .map((k) => ({ field: k, before: changes.before[k], after: changes.after[k] }));
  }
  return Object.entries(changes).map(([field, v]) => {
    if (Array.isArray(v) && v.length === 2) return { field, before: v[0], after: v[1] };
    if (isMap(v) && ('before' in v || 'after' in v)) return { field, before: v.before, after: v.after };
    if (isMap(v) && ('old' in v || 'new' in v)) return { field, before: v.old, after: v.new };
    return { field, before: undefined, after: v };
  });
}

// "What changed" cell: entity + label, and before → after for updates
function WhatChanged({ entry }) {
  const rows = /update/i.test(entry.action || '') ? describeChanges(entry.changes) : [];
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-[#0B1E36] break-words">
        {humanize(entry.entity_type)}
        {entry.entity_label ? <span className="font-normal text-slate-600"> · {entry.entity_label}</span> : null}
      </p>
      {rows.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {rows.map((r) => (
            <li key={r.field} className="text-xs text-slate-500 break-words">
              <span className="font-semibold text-[#0B1E36]">{humanize(r.field)}:</span> {formatValue(r.field, r.before)} →{' '}
              {formatValue(r.field, r.after)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusCell({ entry }) {
  const failed = isFailed(entry.status);
  return (
    <div>
      <StatusPill tone={failed ? 'error' : 'success'}>{failed ? 'Failed' : 'Success'}</StatusPill>
      {failed && entry.error_message && <p className="mt-1 text-xs text-red-800 break-words">{entry.error_message}</p>}
    </div>
  );
}

// Audit Log tab: read-only list of recorded actions (GET /api/audit), newest first.
export default function AuditLog({ isDesktop }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const applied = useDebouncedValue(filters, 350);
  const [data, setData] = useState({ entries: [], total: 0, status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [notice, setNotice] = useState(null);
  const requestRef = useRef(0);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const rangeInvalid = Boolean(applied.dateFrom && applied.dateTo && applied.dateFrom > applied.dateTo);

  useEffect(() => {
    if (rangeInvalid) return;
    const id = ++requestRef.current;
    setData((d) => ({ ...d, status: 'loading' }));
    setNotice(null);
    fetchAudit({ ...applied, q: applied.q.trim(), limit: PAGE_SIZE, offset: 0 })
      .then((res) => id === requestRef.current && setData({ entries: res.entries, total: res.total, status: 'ready' }))
      .catch((err) => {
        console.error('[LOOKit Admin] Could not load the audit log:', err);
        if (id !== requestRef.current) return;
        setData((d) => ({ ...d, status: 'error' }));
        setNotice({ type: 'error', text: errorMessage(err, 'Could not load the audit log.') });
      });
  }, [applied, rangeInvalid]);

  const loadMore = useCallback(async () => {
    const id = requestRef.current;
    setLoadingMore(true);
    setNotice(null);
    try {
      const res = await fetchAudit({ ...applied, q: applied.q.trim(), limit: PAGE_SIZE, offset: data.entries.length });
      if (id === requestRef.current) setData((d) => ({ ...d, entries: [...d.entries, ...res.entries], total: res.total }));
    } catch (err) {
      console.error('[LOOKit Admin] Could not load more audit entries:', err);
      setNotice({ type: 'error', text: errorMessage(err, 'Could not load more entries.') });
    } finally {
      setLoadingMore(false);
    }
  }, [applied, data.entries.length]);

  const { entries, total, status } = data;
  const hasFilters = Object.values(filters).some(Boolean);
  const actionOptions = [...new Set(entries.map((e) => e.action).filter(Boolean))];
  const entityOptions = [...new Set(entries.map((e) => e.entity_type).filter(Boolean))];

  const filterBar = (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
      <div className="col-span-2">
        <Field label="Search">
          <TextInput
            type="search"
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
            placeholder="Actor, action or item"
          />
        </Field>
      </div>
      <Field label="Action">
        <TextInput list="audit-actions" value={filters.action} onChange={(e) => setFilter('action', e.target.value)} placeholder="Any" />
        <datalist id="audit-actions">
          {actionOptions.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </Field>
      <Field label="Entity">
        <TextInput list="audit-entities" value={filters.entityType} onChange={(e) => setFilter('entityType', e.target.value)} placeholder="Any" />
        <datalist id="audit-entities">
          {entityOptions.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </Field>
      <Field label="Status">
        <SelectInput value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">Any</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </SelectInput>
      </Field>
      <Field label="From">
        <TextInput type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(e) => setFilter('dateFrom', e.target.value)} />
      </Field>
      <Field label="To">
        <TextInput type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(e) => setFilter('dateTo', e.target.value)} />
      </Field>
      {hasFilters && (
        <div className="col-span-2 lg:col-span-6">
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs font-bold text-[#0B1E36] hover:underline">
            Clear filters
          </button>
        </div>
      )}
    </div>
  );

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4">When</th>
            <th className="py-2 pr-4">Who</th>
            <th className="py-2 pr-4">Action</th>
            <th className="py-2 pr-4">What changed</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const w = formatWhen(e.created_at);
            return (
              <tr key={e.id} className="border-b border-slate-100 align-top">
                <td className="whitespace-nowrap py-3 pr-4 text-xs text-slate-600">
                  <span className="block font-semibold text-[#0B1E36]">{w.date}</span>
                  {w.time}
                </td>
                <td className="py-3 pr-4 text-sm text-[#0B1E36] break-all">{e.actor_email || '—'}</td>
                <td className="py-3 pr-4 text-sm font-semibold text-[#0B1E36]">{humanize(e.action)}</td>
                <td className="py-3 pr-4">
                  <WhatChanged entry={e} />
                </td>
                <td className="py-3">
                  <StatusCell entry={e} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const cards = (
    <div className="grid grid-cols-1 gap-3">
      {entries.map((e) => {
        const w = formatWhen(e.created_at);
        return (
          <article key={e.id} className="space-y-2 rounded-xl bg-white px-4 py-3 shadow-md">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] text-slate-500">
                {w.date} · {w.time}
              </p>
              <StatusCell entry={e} />
            </div>
            <p className="text-sm font-extrabold text-[#0B1E36]">{humanize(e.action)}</p>
            <p className="text-xs text-slate-500 break-all">{e.actor_email || '—'}</p>
            <WhatChanged entry={e} />
          </article>
        );
      })}
    </div>
  );

  return (
    <section aria-labelledby="audit-title" className="min-w-0 rounded-md border border-[#0B1E36] bg-[#F8F9F9]">
      <div className="px-5 py-5 lg:px-8">
        <h2 id="audit-title" className="mb-4 text-xl font-black uppercase tracking-tight text-[#0B1E36] lg:text-2xl">
          Audit Log
        </h2>
        {filterBar}
        {rangeInvalid && <Notice notice={{ type: 'error', text: 'The start date is after the end date.' }} />}
        {!rangeInvalid && <Notice notice={notice} />}

        {!rangeInvalid && status === 'loading' && entries.length === 0 && <p className="text-sm text-slate-500">Loading audit log…</p>}
        {!rangeInvalid && status === 'ready' && entries.length === 0 && <p className="text-sm text-slate-500">No entries found.</p>}
        {entries.length > 0 && (
          <div className={status === 'loading' ? 'opacity-60 transition-opacity' : ''}>{isDesktop ? table : cards}</div>
        )}

        {entries.length > 0 && (
          <div className="mt-5 space-y-3">
            <p className="text-xs text-slate-500">
              Showing {entries.length} of {total}
            </p>
            {entries.length < total && (
              <div className="max-w-xs">
                <PrimaryButton onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </PrimaryButton>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
>>>>>>> d6a3a47 (updated user, overview, audit logs)
}
