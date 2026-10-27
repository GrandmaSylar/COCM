import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { daysSince, formatBytes } from '@cms/admin-core';
import { Download } from 'lucide-react-native';
import { adminApi } from '../lib/admin';
import { AppText, Button, IconWell, Surface, useToast } from './ui';

// The app's backups are files, not stored on the server, so "backing up" means
// creating one and saving it: the share sheet on a phone, a download in a browser.
async function saveBackup(fileName: string, json: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(json);
  if (!(await Sharing.isAvailableAsync())) throw new Error('This device cannot share files.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save the backup', UTI: 'public.json' });
}

export function BackupSection({ lastBackupAt, onDone }: { lastBackupAt: string | null; onDone: () => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await adminApi.runBackup();
      const fileName = result.backup.fileName || `cocm-backup-${new Date().toISOString().slice(0, 10)}.json`;
      await saveBackup(fileName, JSON.stringify(result.data));
      toast.show({ title: 'Backup created', message: `${fileName} ${formatBytes(result.backup.fileSize)}. Keep it somewhere safe.` });
      setConfirming(false);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backup failed');
    } finally {
      setBusy(false);
    }
  }

  const age = daysSince(lastBackupAt);

  return (
    <Surface style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <IconWell icon={Download} tone={age === null || age > 14 ? 'warning' : 'success'} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="headline">Backup</AppText>
          <AppText variant="caption" tone="muted">
            {age === null ? 'No completed backup on record.' : `Last completed backup: ${age} day${age === 1 ? '' : 's'} ago.`} Take one before making any fixes.
          </AppText>
        </View>
      </View>

      {!confirming ? (
        <Button label="Create and save a backup" variant="secondary" icon={Download} onPress={() => setConfirming(true)} fullWidth />
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label={busy ? 'Creating…' : 'Create and save'} loading={busy} onPress={() => void run()} flex={1} />
          <Button label="Cancel" variant="ghost" disabled={busy} onPress={() => setConfirming(false)} />
        </View>
      )}

      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
      <AppText variant="caption" tone="subtle">
        The backup covers members, children, attendance, giving, expenses, accounts and settings. It does not include zones, ministries or service setups.
      </AppText>
    </Surface>
  );
}
