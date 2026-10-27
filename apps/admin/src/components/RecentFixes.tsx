import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { getRecentFixes } from '../lib/api';
import type { RecentFix } from '../types';
import { EmptyState, ListRow, Section } from '../ui';

function when(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

// Fixes made through this app, newest first. `refreshKey` changes after a fix.
export function RecentFixes({ refreshKey }: { refreshKey: number }) {
  const [fixes, setFixes] = useState<RecentFix[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRecentFixes()
      .then((list) => !cancelled && setFixes(list))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load'));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (error) return <p className="t-caption rounded-md bg-danger-soft px-3 py-2.5 text-danger-text">Fixes: {error}</p>;

  return (
    <Section title="Fixes made here">
      {fixes && fixes.length > 0
        ? fixes.map((f) => (
            <ListRow
              key={f.id}
              title={f.description}
              subtitle={`${f.by}${f.reason ? ` · "${f.reason}"` : ''}`}
              trailing={<span className="t-caption shrink-0 text-subtle">{when(f.createdAt)}</span>}
            />
          ))
        : [<EmptyState key="none" icon={History} title="No fixes yet" message="Corrections you make here are listed with who made them and why." />]}
    </Section>
  );
}
