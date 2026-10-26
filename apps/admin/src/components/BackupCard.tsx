import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { runBackup } from '../lib/api';

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

// The app's backups are files saved to this computer, not stored on the server,
// so "backing up" means creating one and downloading it.
export function BackupCard({ lastBackupAt, onDone }: { lastBackupAt: string | null; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await runBackup();
      const blob = new Blob([JSON.stringify(result.data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.backup.fileName || `cocm-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage({ kind: 'ok', text: `Saved ${result.backup.fileName} ${formatSize(result.backup.fileSize)}. Keep it somewhere safe.` });
      setConfirming(false);
      onDone();
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Backup failed' });
    } finally {
      setBusy(false);
    }
  }

  const age = lastBackupAt ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86400000) : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Backup</h2>
          <p className="text-xs text-slate-500">
            {age === null ? 'No completed backup on record.' : `Last completed backup: ${age} day${age === 1 ? '' : 's'} ago.`} Take one before making any fixes.
          </p>
        </div>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" /> Download a full backup
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button disabled={busy} onClick={() => void run()} className="flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? 'Creating…' : 'Create and download'}
            </button>
            <button disabled={busy} onClick={() => setConfirming(false)} className="rounded-md px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
              Cancel
            </button>
          </div>
        )}
      </div>
      {message && (
        <p className={`mt-2 text-sm ${message.kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{message.text}</p>
      )}
      <p className="mt-2 text-xs text-slate-500">The existing backup covers members, children, attendance, giving, expenses, accounts and settings. It does not include zones, ministries or service setups.</p>
    </section>
  );
}
