import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { timeAgo } from '@cms/admin-core';
import { getRecentFixes } from '../lib/api';
import type { RecentFix } from '../types';
import { EmptyState, ListRow, Section } from '../ui';

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
              trailing={<span className="t-caption shrink-0 text-subtle">{timeAgo(f.createdAt)}</span>}
            />
          ))
        : [<EmptyState key="none" icon={History} title="No fixes yet" message="Corrections you make here are listed with who made them and why." />]}
    </Section>
  );
}
