import { useState } from 'react';
import { Download } from 'lucide-react';
import { runBackup } from '../lib/api';
import { Button, IconWell, Surface, useToast } from '../ui';

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

// The app's backups are files saved to this computer, not stored on the server,
// so "backing up" means creating one and downloading it.
export function BackupCard({ lastBackupAt, onDone }: { lastBackupAt: string | null; onDone: () => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await runBackup();
      const blob = new Blob([JSON.stringify(result.data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.backup.fileName || `cocm-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.show({ title: 'Backup saved', message: `${result.backup.fileName} ${formatSize(result.backup.fileSize)}. Keep it somewhere safe.` });
      setConfirming(false);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backup failed');
    } finally {
      setBusy(false);
    }
  }

  const age = lastBackupAt ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86400000) : null;

  return (
    <Surface className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <IconWell icon={Download} tone={age === null || age > 14 ? 'warning' : 'success'} />
        <div className="min-w-0 flex-1">
          <h2 className="t-headline text-ink">Backup</h2>
          <p className="t-caption text-muted">
            {age === null ? 'No completed backup on record.' : `Last completed backup: ${age} day${age === 1 ? '' : 's'} ago.`} Take one before making any fixes.
          </p>
        </div>
      </div>

      {!confirming ? (
        <Button label="Download a full backup" variant="secondary" icon={Download} onClick={() => setConfirming(true)} />
      ) : (
        <div className="flex gap-2">
          <Button label={busy ? 'Creating…' : 'Create and download'} loading={busy} onClick={() => void run()} />
          <Button label="Cancel" variant="ghost" disabled={busy} onClick={() => setConfirming(false)} />
        </div>
      )}

      {error ? <p className="t-caption text-danger-text">{error}</p> : null}
      <p className="t-caption text-subtle">The backup covers members, children, attendance, giving, expenses, accounts and settings. It does not include zones, ministries or service setups.</p>
    </Surface>
  );
}
