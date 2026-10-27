import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { timeAgo, zoneFixCandidates, type HealthCheck, type HealthReport, type RecentFix, type Severity } from '@cms/admin-core';
import { AlertCircle, AlertTriangle, CheckCircle2, History, Info, Wrench } from 'lucide-react-native';
import { useAppColors } from '../context/ThemeContext';
import { adminApi } from '../lib/admin';
import { AppText, Badge, Chip, DetailRow, EmptyState, ListRow, Section, StatTile, type Tone } from './ui';

const SEVERITY: Record<Severity, { label: string; tone: Tone; icon: typeof Info }> = {
  error: { label: 'Error', tone: 'danger', icon: AlertCircle },
  warn: { label: 'Warning', tone: 'warning', icon: AlertTriangle },
  info: { label: 'Note', tone: 'info', icon: Info },
  ok: { label: 'OK', tone: 'success', icon: CheckCircle2 },
};
const ORDER: Severity[] = ['error', 'warn', 'info', 'ok'];

export function SummaryTiles({ report }: { report: HealthReport }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatTile label="Errors" value={String(report.summary.error)} tone="danger" icon={AlertCircle} />
        <StatTile label="Warnings" value={String(report.summary.warn)} tone="warning" icon={AlertTriangle} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatTile label="Notes" value={String(report.summary.info)} tone="info" icon={Info} />
        <StatTile label="Passing" value={String(report.summary.ok)} tone="success" icon={CheckCircle2} />
      </View>
      <AppText variant="caption" tone="subtle" style={{ paddingHorizontal: 4 }}>
        Generated {timeAgo(report.generatedAt)} in {(report.durationMs / 1000).toFixed(1)}s. Only the Fix and backup buttons change anything.
        {report.loadErrors.length > 0 ? ` Could not read: ${report.loadErrors.join('; ')}` : ''}
      </AppText>
    </View>
  );
}

export function ZoneFixSection({ report }: { report: HealthReport }) {
  const router = useRouter();
  const candidates = useMemo(() => zoneFixCandidates(report), [report]);
  return (
    <Section
      title="Zone numbers to fix"
      footer="Only you can know the right number, so nothing is guessed. Each change shows a preview, needs a reason and a typed confirmation, and is recorded in the activity log."
    >
      {candidates.length > 0 ? (
        candidates.map((candidate) => (
          <ListRow
            key={candidate.id}
            icon={Wrench}
            title={candidate.name}
            subtitle={`${candidate.zoneNumber || '(none)'} · ${candidate.reasons.join(', ')}`}
            onPress={() =>
              router.push({ pathname: '/fix/[id]', params: { id: candidate.id, name: candidate.name, zoneNumber: candidate.zoneNumber, reasons: candidate.reasons.join(', ') } })
            }
          />
        ))
      ) : (
        <EmptyState icon={CheckCircle2} tone="success" title="No zone numbers need fixing" />
      )}
    </Section>
  );
}

export function RecentFixesSection({ refreshKey }: { refreshKey: number }) {
  const [fixes, setFixes] = useState<RecentFix[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getRecentFixes()
      .then((list) => !cancelled && setFixes(list))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load'));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (error) {
    return (
      <AppText variant="caption" tone="danger" style={{ paddingHorizontal: 4 }}>
        Fixes: {error}
      </AppText>
    );
  }
  return (
    <Section title="Fixes made here">
      {fixes && fixes.length > 0 ? (
        fixes.map((f) => <ListRow key={f.id} title={f.description} subtitle={`${f.by}${f.reason ? ` · "${f.reason}"` : ''}`} value={timeAgo(f.createdAt)} />)
      ) : (
        <EmptyState icon={History} title="No fixes yet" message="Corrections you make here are listed with who made them and why." />
      )}
    </Section>
  );
}

function CheckRow({ check }: { check: HealthCheck }) {
  const c = useAppColors();
  const [open, setOpen] = useState(false);
  const s = SEVERITY[check.severity];
  const expandable = check.count > 0;

  return (
    <ListRow
      icon={s.icon}
      iconTone={s.tone}
      title={check.title}
      subtitle={check.description}
      right={<Badge tone={s.tone} label={check.severity === 'ok' ? 'OK' : `${check.count} · ${s.label}`} />}
      onPress={expandable ? () => setOpen((v) => !v) : undefined}
      chevron={false}
    >
      {open ? (
        <View style={{ gap: 6 }}>
          <View style={{ backgroundColor: c.surfaceMuted, borderRadius: 12, padding: 12, gap: 8 }}>
            {check.samples.slice(0, 8).map((sample, i) => (
              <AppText key={i} variant="caption" style={{ fontFamily: 'Courier' }} selectable>
                {JSON.stringify(sample)}
              </AppText>
            ))}
          </View>
          {check.count > Math.min(8, check.samples.length) ? (
            <AppText variant="caption" tone="subtle">
              Showing {Math.min(8, check.samples.length)} of {check.count}.
            </AppText>
          ) : null}
        </View>
      ) : null}
    </ListRow>
  );
}

export function ChecksSection({ report }: { report: HealthReport }) {
  const [issuesOnly, setIssuesOnly] = useState(true);
  const checks = useMemo(
    () => [...report.checks].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity) || b.count - a.count).filter((c) => !issuesOnly || c.severity !== 'ok'),
    [report, issuesOnly],
  );
  return (
    <Section title="Data checks" action={<Chip label="Issues only" selected={issuesOnly} onPress={() => setIssuesOnly((v) => !v)} />}>
      {checks.length > 0 ? checks.map((check) => <CheckRow key={check.id} check={check} />) : <EmptyState icon={CheckCircle2} tone="success" title="No issues found" message="Every check passed." />}
    </Section>
  );
}

export function InfoSections({ report }: { report: HealthReport }) {
  return (
    <>
      <Section title="Accounts">
        {report.users.map((u) => (
          <ListRow
            key={u.id}
            title={u.name}
            subtitle={`${u.email} · ${u.role}`}
            right={
              !u.isActive ? (
                <Badge label="Inactive" />
              ) : u.approvalStatus !== 'approved' ? (
                <Badge tone="warning" label={u.approvalStatus} />
              ) : (
                <AppText variant="caption" tone="subtle">
                  {timeAgo(u.lastLogin)}
                </AppText>
              )
            }
          />
        ))}
      </Section>

      <Section title="Backups" footer="Backups are files saved to a device. These are the ones recorded so far.">
        {report.backups.length > 0 ? (
          report.backups.map((b) => <ListRow key={b.id} title={`${b.type} · ${b.status}`} subtitle={b.fileName} value={timeAgo(b.completedAt ?? b.createdAt)} />)
        ) : (
          <EmptyState icon={Info} title="No backups recorded" />
        )}
      </Section>

      <Section title={`Activity · ${report.activity.last7Days} events in the last 7 days`}>
        {report.activity.latest.map((a) => (
          <ListRow key={a.id} title={a.description || `${a.action} ${a.entityType}`} subtitle={`${a.user} · ${a.action}`} value={timeAgo(a.createdAt)} />
        ))}
      </Section>

      <Section title="Row counts">
        {Object.entries(report.counts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([table, n]) => (
            <DetailRow key={table} label={table} value={String(n ?? '?')} />
          ))}
      </Section>

      <AppText variant="caption" tone="subtle" style={{ paddingHorizontal: 4 }}>
        Sync queues and conflicts live on each device (the browser's IndexedDB and the phone's SQLite), so the server cannot see them. Check those from the app's own sync screens.
      </AppText>
    </>
  );
}

