import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Info, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { AdminApiError, getHealth } from '../lib/api';
import type { HealthCheck, HealthReport, Severity } from '../types';
import { BackupCard } from './BackupCard';
import { FixZoneNumbers } from './FixZoneNumbers';
import { RecentFixes } from './RecentFixes';

const SEVERITY_STYLE: Record<Severity, { label: string; icon: typeof Info; chip: string }> = {
  error: { label: 'Error', icon: AlertCircle, chip: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' },
  warn: { label: 'Warning', icon: AlertTriangle, chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  info: { label: 'Note', icon: Info, chip: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300' },
  ok: { label: 'OK', icon: CheckCircle2, chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
};

const ORDER: Severity[] = ['error', 'warn', 'info', 'ok'];

const card = 'rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';

function when(iso: string | null) {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function CheckRow({ check }: { check: HealthCheck }) {
  const [open, setOpen] = useState(false);
  const style = SEVERITY_STYLE[check.severity];
  const Icon = style.icon;
  const expandable = check.count > 0;

  return (
    <li className="px-4 py-3">
      <button
        type="button"
        disabled={!expandable}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left disabled:cursor-default"
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{check.title}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{check.description}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.chip}`}>
          {check.severity === 'ok' ? 'OK' : `${check.count} · ${style.label}`}
        </span>
        {expandable && (open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />)}
      </button>
      {open && (
        <div className="mt-3 ml-7">
          <pre className="max-h-96 overflow-auto rounded-md bg-slate-100 p-3 text-xs dark:bg-slate-950">{JSON.stringify(check.samples, null, 2)}</pre>
          {check.count > check.samples.length && (
            <p className="mt-1 text-xs text-slate-500">Showing {check.samples.length} of {check.count}.</p>
          )}
        </div>
      )}
    </li>
  );
}

export function Dashboard({ email, onSignOut }: { email: string; onSignOut: (reason?: string) => void }) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuesOnly, setIssuesOnly] = useState(true);
  const [fixCount, setFixCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await getHealth());
    } catch (e) {
      if (e instanceof AdminApiError && (e.status === 401 || e.status === 403)) {
        onSignOut(e.status === 403 ? 'This account is not a developer account.' : 'Your session has expired. Sign in again.');
        return;
      }
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [onSignOut]);

  useEffect(() => { void load(); }, [load]);

  const afterChange = useCallback(() => {
    setFixCount((n) => n + 1);
    void load();
  }, [load]);

  const checks = report
    ? [...report.checks]
        .sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity) || b.count - a.count)
        .filter((c) => !issuesOnly || c.severity !== 'ok')
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">CoC.M Admin</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Health report and fixes for the live database · {email}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </button>
          <button onClick={() => onSignOut()} className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {!report && loading && <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}

      {report && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ORDER.map((sev) => (
              <div key={sev} className={`${card} p-4`}>
                <p className="text-xs uppercase tracking-wide text-slate-500">{SEVERITY_STYLE[sev].label === 'OK' ? 'Passing' : SEVERITY_STYLE[sev].label + 's'}</p>
                <p className="mt-1 text-2xl font-semibold">{report.summary[sev]}</p>
              </div>
            ))}
          </section>
          <p className="text-xs text-slate-500">
            Generated {when(report.generatedAt)} in {(report.durationMs / 1000).toFixed(1)}s. Only the Fix buttons change data.
            {report.loadErrors.length > 0 && <span className="text-red-600"> Could not read: {report.loadErrors.join('; ')}</span>}
          </p>

          <BackupCard lastBackupAt={report.backups.find((b) => b.status === 'completed')?.completedAt ?? null} onDone={afterChange} />
          <FixZoneNumbers report={report} onChanged={afterChange} />
          <RecentFixes refreshKey={fixCount} />

          <section className={card}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h2 className="font-medium">Data checks</h2>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} /> Issues only
              </label>
            </div>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {checks.map((c) => <CheckRow key={c.id} check={c} />)}
              {checks.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">No issues found.</li>}
            </ul>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className={card}>
              <h2 className="border-b border-slate-200 px-4 py-3 font-medium dark:border-slate-800">Accounts</h2>
              <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
                {report.users.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="min-w-0">
                      <span className="block truncate">{u.name} <span className="text-slate-500">· {u.role}</span></span>
                      <span className="block truncate text-xs text-slate-500">{u.email}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-slate-500">
                      {!u.isActive ? 'inactive' : u.approvalStatus !== 'approved' ? u.approvalStatus : when(u.lastLogin)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={card}>
              <h2 className="border-b border-slate-200 px-4 py-3 font-medium dark:border-slate-800">Backups</h2>
              <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
                {report.backups.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="min-w-0">
                      <span className="block truncate">{b.type} · {b.status}</span>
                      <span className="block truncate text-xs text-slate-500">{b.fileName}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{when(b.completedAt ?? b.createdAt)}</span>
                  </li>
                ))}
                {report.backups.length === 0 && <li className="px-4 py-3 text-slate-500">No backups recorded.</li>}
              </ul>
            </div>
          </section>

          <section className={card}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h2 className="font-medium">Activity</h2>
              <span className="text-xs text-slate-500">{report.activity.last7Days} events in the last 7 days</span>
            </div>
            <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
              {report.activity.latest.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{a.description || `${a.action} ${a.entityType}`}</span>
                    <span className="block text-xs text-slate-500">{a.user} · {a.action}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{when(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={card}>
            <h2 className="border-b border-slate-200 px-4 py-3 font-medium dark:border-slate-800">Row counts</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 px-4 py-3 text-sm sm:grid-cols-3">
              {Object.entries(report.counts).sort(([a], [b]) => a.localeCompare(b)).map(([table, n]) => (
                <div key={table} className="flex justify-between gap-2">
                  <dt className="truncate text-slate-500">{table}</dt>
                  <dd className="tabular-nums">{n ?? '?'}</dd>
                </div>
              ))}
            </dl>
          </section>

          <p className="text-xs text-slate-500">
            Sync queues and conflicts live on each device (the browser's IndexedDB and the phone's SQLite), so the server cannot see them. Check those from the app's own sync screens.
          </p>
        </>
      )}
    </div>
  );
}
