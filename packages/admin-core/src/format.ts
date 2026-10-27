/** "just now", "5m ago", "3h ago", "12d ago". */
export function timeAgo(iso: string | null | undefined, nowMs: number = Date.now()): string {
  if (!iso) return 'never';
  const mins = Math.round((nowMs - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '';
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/** Whole days since the date, or null when there is no date. */
export function daysSince(iso: string | null | undefined, nowMs: number = Date.now()): number | null {
  return iso ? Math.floor((nowMs - new Date(iso).getTime()) / 86400000) : null;
}
