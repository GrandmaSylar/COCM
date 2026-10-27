import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, LogOut, Moon, RefreshCw, Sun } from 'lucide-react';
import { timeAgo } from '@cms/admin-core';
import { AdminApiError, getHealth } from '../lib/api';
import { useTheme } from '../theme/ThemeProvider';
import type { HealthCheck, HealthReport, Severity } from '../types';
import { Badge, Chip, DetailRow, EmptyState, Header, IconButton, IconWell, ListRow, Page, Section, StatTile, Surface, type Tone } from '../ui';
import { BackupCard } from './BackupCard';
import { FixZoneNumbers } from './FixZoneNumbers';
import { RecentFixes } from './RecentFixes';

const SEVERITY: Record<Severity, { label: string; tone: Tone; icon: typeof Info }> = {
  error: { label: 'Error', tone: 'danger', icon: AlertCircle },
  warn: { label: 'Warning', tone: 'warning', icon: AlertTriangle },
  info: { label: 'Note', tone: 'info', icon: Info },
  ok: { label: 'OK', tone: 'success', icon: CheckCircle2 },
};

const ORDER: Severity[] = ['error', 'warn', 'info', 'ok'];

function CheckRow({ check }: { check: HealthCheck }) {
  const [open, setOpen] = useState(false);
  const s = SEVERITY[check.severity];
  const expandable = check.count > 0;

  return (
    <div>
      <ListRow
        leading={<IconWell icon={s.icon} tone={s.tone} />}
        title={check.title}
        subtitle={check.description}
        trailing={<Badge tone={s.tone} label={check.severity === 'ok' ? 'OK' : `${check.count} · ${s.label}`} />}
        onClick={expandable ? () => setOpen((v) => !v) : undefined}
        expanded={open}
      />
      {open ? (
        <div className="px-4 pb-4">
          <pre className="max-h-96 overflow-auto rounded-md bg-surface-muted p-3 font-mono text-xs text-ink">{JSON.stringify(check.samples, null, 2)}</pre>
          {check.count > check.samples.length ? (
            <p className="t-caption mt-1 text-subtle">
              Showing {check.samples.length} of {check.count}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function Dashboard({ email, onSignOut }: { email: string; onSignOut: (reason?: string) => void }) {
  const { isDark, toggle } = useTheme();
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

  useEffect(() => {
    void load();
  }, [load]);

  const afterChange = useCallback(() => {
    setFixCount((n) => n + 1);
    void load();
  }, [load]);

  const checks = report
    ? [...report.checks].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity) || b.count - a.count).filter((c) => !issuesOnly || c.severity !== 'ok')
    : [];

  return (
    <>
      <Header
        title="CoC.M Admin"
        subtitle={email}
        right={
          <div className="flex items-center">
            <IconButton icon={isDark ? Sun : Moon} label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle} />
            <IconButton icon={loading ? Loader2 : RefreshCw} label="Refresh" onClick={() => void load()} disabled={loading} />
            <IconButton icon={LogOut} label="Sign out" onClick={() => onSignOut()} />
          </div>
        }
      />
      <Page>
        {error ? <p className="t-caption rounded-md bg-danger-soft px-3 py-2.5 text-danger-text">{error}</p> : null}
        {!report && loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-subtle" size={24} />
          </div>
        ) : null}

        {report ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Errors" value={report.summary.error} tone="danger" icon={AlertCircle} />
              <StatTile label="Warnings" value={report.summary.warn} tone="warning" icon={AlertTriangle} />
              <StatTile label="Notes" value={report.summary.info} tone="info" icon={Info} />
              <StatTile label="Passing" value={report.summary.ok} tone="success" icon={CheckCircle2} />
            </div>
            <p className="t-caption -mt-2 px-1 text-subtle">
              Generated {timeAgo(report.generatedAt)} in {(report.durationMs / 1000).toFixed(1)}s. Only the Fix and backup buttons change anything.
              {report.loadErrors.length > 0 ? <span className="text-danger-text"> Could not read: {report.loadErrors.join('; ')}</span> : null}
            </p>

            <BackupCard lastBackupAt={report.backups.find((b) => b.status === 'completed')?.completedAt ?? null} onDone={afterChange} />
            <FixZoneNumbers report={report} onChanged={afterChange} />
            <RecentFixes refreshKey={fixCount} />

            <Section title="Data checks" action={<Chip label="Issues only" selected={issuesOnly} onClick={() => setIssuesOnly((v) => !v)} />}>
              {checks.length > 0
                ? checks.map((c) => <CheckRow key={c.id} check={c} />)
                : [<EmptyState key="none" icon={CheckCircle2} tone="success" title="No issues found" message="Every check passed." />]}
            </Section>

            <Section title="Accounts">
              {report.users.map((u) => (
                <ListRow
                  key={u.id}
                  title={u.name}
                  subtitle={`${u.email} · ${u.role}`}
                  trailing={
                    !u.isActive ? (
                      <Badge label="Inactive" />
                    ) : u.approvalStatus !== 'approved' ? (
                      <Badge tone="warning" label={u.approvalStatus} />
                    ) : (
                      <span className="t-caption shrink-0 text-subtle">{timeAgo(u.lastLogin)}</span>
                    )
                  }
                />
              ))}
            </Section>

            <Section title="Backups" footer="Backups are files saved to a computer. These are the ones recorded so far.">
              {report.backups.length > 0
                ? report.backups.map((b) => (
                    <ListRow
                      key={b.id}
                      title={`${b.type} · ${b.status}`}
                      subtitle={b.fileName}
                      trailing={<span className="t-caption shrink-0 text-subtle">{timeAgo(b.completedAt ?? b.createdAt)}</span>}
                    />
                  ))
                : [<EmptyState key="none" icon={Info} title="No backups recorded" />]}
            </Section>

            <Section title={`Activity · ${report.activity.last7Days} events in the last 7 days`}>
              {report.activity.latest.map((a) => (
                <ListRow
                  key={a.id}
                  title={a.description || `${a.action} ${a.entityType}`}
                  subtitle={`${a.user} · ${a.action}`}
                  trailing={<span className="t-caption shrink-0 text-subtle">{timeAgo(a.createdAt)}</span>}
                />
              ))}
            </Section>

            <Section title="Row counts" bare>
              <Surface padded={false}>
                <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-border">
                  {[0, 1].map((col) => (
                    <div key={col} className="divide-y divide-border">
                      {Object.entries(report.counts)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .filter((_, i) => i % 2 === col)
                        .map(([table, n]) => (
                          <DetailRow key={table} label={table} value={n ?? '?'} />
                        ))}
                    </div>
                  ))}
                </div>
              </Surface>
            </Section>

            <p className="t-caption px-1 text-subtle">
              Sync queues and conflicts live on each device (the browser's IndexedDB and the phone's SQLite), so the server cannot see them. Check those from the app's own sync
              screens.
            </p>
          </>
        ) : null}
      </Page>
    </>
  );
}
