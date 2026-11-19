
import React, { useEffect, useRef, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { fetchAudit, exportAuditExcel } from '../data/auditService';
import { errorMessage } from '../data/usersService';
import useDebouncedValue from '../hooks/useDebouncedValue';
import StatusPill from '../components/StatusPill';
import { Notice } from '../components/AdminControls';
import { AuditLogSkeleton } from '../components/AdminSkeletons';

const DISPLAY_LIMIT = 10;

const humanize = (s = '') => {
  const t = String(s).replace(/[_-]+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
};

const isFailed = (status) => /fail|error/i.test(status || '');

// Highlight matching search text in light blue.
function Highlight({ text, search }) {
  const value = String(text ?? '');
  const keyword = search.trim();

  if (!keyword) return value;

  const index = value.toLowerCase().indexOf(keyword.toLowerCase());
  if (index === -1) return value;

  const parts = [];
  let start = 0;
  let match = index;

  while (match !== -1) {
    if (match > start) parts.push(value.slice(start, match));

    parts.push(
      <mark
        key={match}
        className="rounded-[3px] bg-[#BFDBFE] px-0.5 text-[#0B2545]"
      >
        {value.slice(match, match + keyword.length)}
      </mark>
    );

    start = match + keyword.length;
    match = value.toLowerCase().indexOf(keyword.toLowerCase(), start);
  }

  if (start < value.length) parts.push(value.slice(start));

  return <>{parts}</>;
}

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

function WhatChanged({ entry, search }) {
  const rows = /update/i.test(entry.action || '') ? describeChanges(entry.changes) : [];

  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-[#0B2545] break-words">
        <Highlight text={humanize(entry.entity_type)} search={search} />
        {entry.entity_label ? (
          <span className="font-normal text-slate-600">
            {' · '}<Highlight text={entry.entity_label} search={search} />
          </span>
        ) : null}
      </p>
      {rows.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {rows.map((r) => (
            <li key={r.field} className="text-xs text-slate-500 break-words">
              <span className="font-semibold text-[#0B2545]">
                <Highlight text={humanize(r.field)} search={search} />:
              </span>{' '}
              <Highlight text={formatValue(r.field, r.before)} search={search} /> →{' '}
              <Highlight text={formatValue(r.field, r.after)} search={search} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusCell({ entry, search }) {
  const failed = isFailed(entry.status);
  const label = failed ? 'Failed' : 'Success';

  return (
    <div>
      <StatusPill tone={failed ? 'error' : 'success'}>
        <Highlight text={label} search={search} />
      </StatusPill>
      {failed && entry.error_message && (
        <p className="mt-1 text-xs text-red-800 break-words">
          <Highlight text={entry.error_message} search={search} />
        </p>
      )}
    </div>
  );
}

export default function AuditLog({ isDesktop }) {
  const [search, setSearch] = useState('');
  const appliedSearch = useDebouncedValue(search, 350);
  const [data, setData] = useState({ entries: [], total: 0, status: 'loading' });
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const id = ++requestRef.current;
    setData((d) => ({ ...d, status: 'loading' }));
    setNotice(null);

    fetchAudit({ q: appliedSearch.trim(), limit: DISPLAY_LIMIT, offset: 0 })
      .then((res) => {
        if (id !== requestRef.current) return;
        setData({ entries: res.entries.slice(0, DISPLAY_LIMIT), total: res.total, status: 'ready' });
      })
      .catch((err) => {
        console.error('[LOOKit Admin] Could not load the audit log:', err);
        if (id !== requestRef.current) return;
        setData((d) => ({ ...d, status: 'error' }));
        setNotice({ type: 'error', text: errorMessage(err, 'Could not load the audit log.') });
      });

    return () => { requestRef.current += 1; };
  }, [appliedSearch]);

  const handleExport = async () => {
    setExporting(true);
    setNotice(null);
    try {
      await exportAuditExcel({ q: search.trim() });
    } catch (err) {
      setNotice({ type: 'error', text: 'Failed to export logs to Excel.' });
    } finally {
      setExporting(false);
    }
  };

  const { entries, total, status } = data;

  // Original Staff page search bar styling
  const searchBar = isDesktop ? (
    <div className="mb-5 w-full">
      <div className="w-full h-14 bg-[#E5EEF7] rounded-full px-6 flex items-center gap-3 shadow-inner focus-within:ring-2 focus-within:ring-[#0B2545]/20 transition">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search records"
          aria-label="Search audit records"
          className="w-full min-w-0 bg-transparent text-sm text-[#0B2545] placeholder-[#64748B] focus:outline-none font-medium"
        />
        <Search className="w-5 h-5 text-[#475569] shrink-0 stroke-[2]" />
      </div>
    </div>
  ) : (
    <div className="mb-5 w-full">
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#E5EEF7] text-[#4A5568] shadow-inner transition-colors focus-within:bg-[#DBE7F3]">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search records"
          aria-label="Search audit records"
          className="w-full min-w-0 bg-transparent text-xs font-medium text-gray-800 placeholder-[#607289] focus:outline-none"
        />
        <Search className="w-4 h-4 text-[#4A5568] shrink-0 stroke-[2.2]" />
      </div>
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
                  <span className="block font-semibold text-[#0B2545]">
                    <Highlight text={w.date} search={search} />
                  </span>
                  <Highlight text={w.time} search={search} />
                </td>
                <td className="py-3 pr-4 text-sm text-[#0B2545] break-all">
                  <Highlight text={e.actor_email || '—'} search={search} />
                </td>
                <td className="py-3 pr-4 text-sm font-semibold text-[#0B2545]">
                  <Highlight text={humanize(e.action)} search={search} />
                </td>
                <td className="py-3 pr-4">
                  <WhatChanged entry={e} search={search} />
                </td>
                <td className="py-3">
                  <StatusCell entry={e} search={search} />
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
                <Highlight text={`${w.date} · ${w.time}`} search={search} />
              </p>
              <StatusCell entry={e} search={search} />
            </div>
            <p className="text-sm font-extrabold text-[#0B2545]">
              <Highlight text={humanize(e.action)} search={search} />
            </p>
            <p className="text-xs text-slate-500 break-all">
              <Highlight text={e.actor_email || '—'} search={search} />
            </p>
            <WhatChanged entry={e} search={search} />
          </article>
        );
      })}
    </div>
  );

  return (
    <section aria-labelledby="audit-title" className="min-w-0 rounded-md border border-[#0B2545] bg-[#F8F9F9]">
      <div className="px-5 py-5 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 id="audit-title" className="text-xl font-black uppercase tracking-tight text-[#0B2545] lg:text-2xl">
            Audit Log
          </h2>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg bg-[#0B2545] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#142F50] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>

        {searchBar}
        <Notice notice={notice} />

        {status === 'loading' && entries.length === 0 && <AuditLogSkeleton isDesktop={isDesktop} />}
        {status === 'ready' && entries.length === 0 && <p className="text-sm text-slate-500">No records found.</p>}

        {entries.length > 0 && (
          <div className={status === 'loading' ? 'opacity-60 transition-opacity' : ''}>
            {isDesktop ? table : cards}
          </div>
        )}

        {entries.length > 0 && (
          <div className="mt-5 space-y-3">
            <p className="text-xs font-semibold text-[#0B2545] rounded-md bg-[#E5EEF7] p-3">
              Showing the latest {entries.length} of {total} transactions. Please click "Export to Excel" to download and view the complete audit history.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}