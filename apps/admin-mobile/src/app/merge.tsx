import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { MergePreview } from '@cms/admin-core';
import { AppHeader } from '../components/AppHeader';
import { AppText, Button, Chip, Screen, Surface, TextField, useToast } from '../components/ui';
import { useAdminData } from '../context/AdminDataContext';
import { useAppColors } from '../context/ThemeContext';
import { adminApi } from '../lib/admin';

interface GroupMember {
  id: string;
  name: string;
  zoneNumber: string;
  phone: string;
}

const FIELD_LABELS: Record<string, string> = {
  other_names: 'Other names',
  email: 'Email',
  second_phone: 'Second phone',
  gender: 'Gender',
  date_of_birth: 'Date of birth',
  digital_address: 'Digital address',
  notes: 'Notes',
  photo_url: 'Photo',
  baptism_info: 'Baptism details',
  legal_info: 'ID details',
  ministries: 'Ministries',
  first_name: 'First name',
  last_name: 'Last name',
  phone: 'Phone',
  residence_location: 'Residence',
  zone: 'Zone',
  zone_number: 'Zone number',
  status: 'Status',
  join_date: 'Join date',
};

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(blank)';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(none)';
  if (typeof value === 'object') return 'has details';
  return String(value);
}

const label = (m: GroupMember) => `${m.zoneNumber || '(none)'}${m.phone ? ` · ${m.phone}` : ''}`;

export default function MergeMembersScreen() {
  const c = useAppColors();
  const router = useRouter();
  const toast = useToast();
  const { reload } = useAdminData();
  const { members: membersParam } = useLocalSearchParams<{ members?: string }>();

  const members = useMemo<GroupMember[]>(() => {
    try {
      const parsed = JSON.parse(String(membersParam ?? '[]'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [membersParam]);

  const [keepId, setKeepId] = useState(members[0]?.id ?? '');
  const [dropId, setDropId] = useState<string | null>(null);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const others = members.filter((m) => m.id !== keepId);

  function reset() {
    setPreview(null);
    setSkipped([]);
    setConfirm('');
    setError(null);
  }

  async function runPreview() {
    if (!dropId) return;
    setBusy('preview');
    reset();
    try {
      setPreview(await adminApi.previewMerge(keepId, dropId));
    } catch (e) {
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
      const result = await adminApi.applyMerge({
        keepId,
        dropId: dropId as string,
        expectedKeepUpdatedAt: preview.keep.updatedAt,
        expectedDropUpdatedAt: preview.drop.updatedAt,
        fill: preview.fills.map((f) => f.field).filter((f) => !skipped.includes(f)),
        reason,
        confirm,
      });
      toast.show({ title: 'Members merged', message: `${result.name} (${result.zoneNumber}) now holds both records.` });
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
      <AppHeader title="Merge members" subtitle={members[0]?.name} onBack={goBack} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 20 }} keyboardShouldPersistTaps="handled">
          {members.length < 2 ? (
            <AppText variant="body" tone="muted">
              Nothing to merge here. Go back and pick a group.
            </AppText>
          ) : (
            <>
              <View style={{ gap: 8 }}>
                <AppText variant="captionStrong">Which record should be kept?</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {members.map((m) => (
                    <Chip
                      key={m.id}
                      label={label(m)}
                      selected={m.id === keepId}
                      onPress={() => {
                        setKeepId(m.id);
                        setDropId(null);
                        reset();
                      }}
                    />
                  ))}
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <AppText variant="captionStrong">Merge which duplicate into it?</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {others.map((m) => (
                    <Chip
                      key={m.id}
                      label={label(m)}
                      selected={m.id === dropId}
                      onPress={() => {
                        setDropId(m.id);
                        reset();
                      }}
                    />
                  ))}
                </View>
                <Button label="Review the merge" variant="secondary" loading={busy === 'preview'} disabled={!dropId} onPress={() => void runPreview()} fullWidth />
              </View>
            </>
          )}

          {preview ? (
            <View style={{ gap: 16 }}>
              <AppText variant="body">
                Keep <AppText variant="bodyStrong">{preview.keep.name}</AppText> ({preview.keep.zoneNumber}). The record {preview.drop.zoneNumber} is deleted after everything on it is moved across. A full copy of it is kept in the activity log.
              </AppText>

              {preview.warnings.length > 0 ? (
                <View style={{ backgroundColor: c.warning.soft, borderRadius: 12, padding: 12, gap: 4 }}>
                  {preview.warnings.map((w) => (
                    <AppText key={w} variant="caption" tone="warning">
                      {w}
                    </AppText>
                  ))}
                </View>
              ) : null}

              <Surface style={{ gap: 4 }}>
                <AppText variant="captionStrong">Moves to the kept record</AppText>
                {preview.references.length > 0 ? (
                  preview.references.map((r) => (
                    <AppText key={r.label} variant="caption" tone="muted">
                      {r.label}: {r.count}
                    </AppText>
                  ))
                ) : (
                  <AppText variant="caption" tone="muted">
                    Nothing else is linked to the duplicate.
                  </AppText>
                )}
              </Surface>

              {preview.fills.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <AppText variant="captionStrong">Blank on the kept record, copied from the duplicate (tap to skip)</AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {preview.fills.map((f) => (
                      <Chip
                        key={f.field}
                        label={`${FIELD_LABELS[f.field] ?? f.field}: ${show(f.value)}`}
                        selected={!skipped.includes(f.field)}
                        onPress={() => setSkipped((prev) => (prev.includes(f.field) ? prev.filter((x) => x !== f.field) : [...prev, f.field]))}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {preview.differences.length > 0 ? (
                <Surface style={{ gap: 4 }}>
                  <AppText variant="captionStrong">Different on each record (the kept record's value stays)</AppText>
                  {preview.differences.map((d) => (
                    <AppText key={d.field} variant="caption" tone="muted">
                      {FIELD_LABELS[d.field] ?? d.field}: keeping {show(d.keep)}, discarding {show(d.drop)}
                    </AppText>
                  ))}
                </Surface>
              ) : null}

              {preview.canApply ? (
                <>
                  <TextField label="Why? (recorded in the activity log)" value={reason} placeholder="e.g. Same person entered twice at registration" onChangeText={setReason} />
                  <TextField label={`Type ${preview.confirmPhrase} to confirm`} value={confirm} autoCapitalize="characters" autoCorrect={false} onChangeText={setConfirm} />
                  <Button label="Merge members" variant="danger" loading={busy === 'apply'} disabled={!ready} onPress={() => void apply()} fullWidth />
                </>
              ) : (
                <View style={{ backgroundColor: c.danger.soft, borderRadius: 12, padding: 12, gap: 4 }}>
                  {preview.problems.map((p) => (
                    <AppText key={p} variant="caption" tone="danger">
                      {p}
                    </AppText>
                  ))}
                </View>
              )}
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
