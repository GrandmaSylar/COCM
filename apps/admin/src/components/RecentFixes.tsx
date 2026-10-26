import { useEffect, useState } from 'react';
import { getRecentFixes } from '../lib/api';
import type { RecentFix } from '../types';

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

  return (
    <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <h2 className="border-b border-slate-200 px-4 py-3 font-medium dark:border-slate-800">Fixes made here</h2>
      {error && <p className="px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
      {fixes && fixes.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No fixes yet.</p>}
      <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
        {(fixes ?? []).map((f) => (
          <li key={f.id} className="px-4 py-2">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">{f.description}</span>
              <span className="shrink-0 text-xs text-slate-500">{when(f.createdAt)}</span>
            </div>
            <p className="text-xs text-slate-500">
              {f.by}
              {f.reason ? ` · "${f.reason}"` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
