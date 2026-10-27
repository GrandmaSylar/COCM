import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ZoneFixPreview } from '@cms/admin-core';
import { AppHeader } from '../../components/AppHeader';
import { AppText, Avatar, Button, Screen, Surface, TextField, useToast } from '../../components/ui';
import { useAdminData } from '../../context/AdminDataContext';
import { useAppColors } from '../../context/ThemeContext';
import { adminApi } from '../../lib/admin';

export default function FixZoneNumberScreen() {
  const c = useAppColors();
  const router = useRouter();
  const toast = useToast();
  const { reload } = useAdminData();
  const { id, name, zoneNumber, reasons } = useLocalSearchParams<{ id: string; name?: string; zoneNumber?: string; reasons?: string }>();

  const [proposed, setProposed] = useState('');
  const [preview, setPreview] = useState<ZoneFixPreview | null>(null);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  async function runPreview() {
    setBusy('preview');
    setError(null);
    setConfirm('');
    try {
      setPreview(await adminApi.previewZoneFix(String(id), proposed));
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!preview) return;
    setBusy('apply');
    setError(null);
    try {
      const result = await adminApi.applyZoneFix({ memberId: String(id), proposed: preview.proposed, expectedCurrent: preview.member.zoneNumber, reason, confirm });
      toast.show({ title: 'Zone number updated', message: `${result.name}: ${result.before || '(none)'} → ${result.after}` });
      void reload();
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(null);
    }
  }

  const ready = Boolean(preview?.canApply) && reason.trim().length >= 5 && confirm.trim() === preview?.confirmPhrase;

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <AppHeader title="Fix zone number" subtitle={name} onBack={goBack} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 20 }} keyboardShouldPersistTaps="handled">
          <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={name} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {name}
              </AppText>
              <AppText variant="caption" tone="muted">
                Now: {zoneNumber || '(none)'}
                {reasons ? ` · ${reasons}` : ''}
              </AppText>
            </View>
          </Surface>

          <View style={{ gap: 12 }}>
            <TextField label="New zone number" placeholder="e.g. A12" value={proposed} autoCapitalize="characters" autoCorrect={false} onChangeText={(v) => { setProposed(v); setPreview(null); setError(null); }} />
            <Button label="Preview" variant="secondary" loading={busy === 'preview'} disabled={!proposed.trim()} onPress={() => void runPreview()} fullWidth />
          </View>

          {preview ? (
            <View style={{ gap: 16 }}>
              <AppText variant="body">
                {preview.member.zoneNumber || '(none)'} → <AppText variant="bodyStrong">{preview.proposed}</AppText> for {preview.member.name} <AppText variant="body" tone="muted">(zone {preview.member.zone})</AppText>
              </AppText>

              {preview.problems.length > 0 ? (
                <View style={{ backgroundColor: c.danger.soft, borderRadius: 12, padding: 12, gap: 4 }}>
                  {preview.problems.map((p) => (
                    <AppText key={p} variant="caption" tone="danger">
                      {p}
                    </AppText>
                  ))}
                </View>
              ) : null}

              {preview.canApply ? (
                <>
                  <TextField label="Why? (recorded in the activity log)" value={reason} placeholder="e.g. Confirmed against the paper register" onChangeText={setReason} />
                  <TextField label={`Type ${preview.confirmPhrase} to confirm`} value={confirm} autoCapitalize="characters" autoCorrect={false} onChangeText={setConfirm} />
                  <Button label="Apply change" loading={busy === 'apply'} disabled={!ready} onPress={() => void apply()} fullWidth />
                </>
              ) : null}
            </View>
          ) : null}

          {error ? (
            <AppText variant="caption" tone="danger">
              {error}
            </AppText>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
