import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Download, Eye } from '@tamagui/lucide-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { api } from '../../lib/api';
import { getLocalCustomServices, getLocalMembers, LocalMember } from '../../lib/db';
import { loadCachedServiceSetups } from '../../lib/serviceRecords';
import {
  Officiator,
  previewServiceSetupPdf,
  ProgrammeRow,
  SetupFormData,
  shareServiceSetupPdf,
} from '../../lib/serviceSetupPdf';
import { AppHeader } from '../../components/AppHeader';
import { MemberNameField } from '../../components/MemberNameField';
import { NativeDatePicker } from '../../components/NativeDatePicker';
import { AppText, ChoiceChips, FieldGroup, IconButton, Screen, SaveBar, Section, Surface, TextField, useToast } from '../../components/ui';
import { space } from '../../theme/tokens';

const DEFAULT_PROGRAMME: ProgrammeRow[] = [
  { activity: 'Divisional Bible Class', startTime: '08:30', endTime: '09:25', duration: '1 hr', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'Opening Prayer', startTime: '09:30', endTime: '09:35', duration: '5 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'Worship and Praises', startTime: '09:35', endTime: '10:05', duration: '30 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'Scripture Reading', startTime: '10:05', endTime: '10:10', duration: '5 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'Sermon', startTime: '10:10', endTime: '10:55', duration: '45 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'After-Sermon Prayer', startTime: '10:55', endTime: '11:00', duration: '5 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: "Lord's Supper & Giving Assistants", startTime: '11:00', endTime: '11:15', duration: '20 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'Worship Closing Prayer', startTime: '11:15', endTime: '11:20', duration: '5 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'Announcements', startTime: '11:20', endTime: '11:30', duration: '10 min', assignedMemberId: '', assignedMemberName: '' },
  { activity: 'Benediction', startTime: '11:30', endTime: '', duration: '5 min', assignedMemberId: '', assignedMemberName: '' },
];

const emptyOfficiators = (): Officiator[] => [1, 2, 3, 4, 5, 6].map(slot => ({ slot, memberId: '', memberName: '' }));
const todayStr = () => new Date().toISOString().split('T')[0];

interface FormState extends SetupFormData {
  mcMemberId: string;
  preacherMemberId: string;
}

const emptyForm = (): FormState => ({
  serviceDate: todayStr(),
  time: '',
  serviceType: 'Sunday Main Service',
  mcMemberId: '',
  mcName: '',
  sermonTopic: '',
  scriptureEnglish: '',
  scriptureTwi: '',
  preacherMemberId: '',
  preacherName: '',
});

const clean = (id?: string | null) => (!id ? null : id);

export default function ServiceSetupScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [members, setMembers] = useState<LocalMember[]>([]);
  const [serviceTypes, setServiceTypes] = useState<string[]>(['Sunday Main Service']);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [programme, setProgramme] = useState<ProgrammeRow[]>(DEFAULT_PROGRAMME.map(r => ({ ...r })));
  const [officiators, setOfficiators] = useState<Officiator[]>(emptyOfficiators);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const skipNextLookup = useRef(!!id);

  useEffect(() => {
    getLocalMembers().then(setMembers).catch(() => {});
    getLocalCustomServices()
      .then(list => setServiceTypes(['Sunday Main Service', ...list.filter(s => s.is_active !== 0 && s.name !== 'Sunday Main Service').map(s => s.name)]))
      .catch(() => {});
  }, []);

  const apply = useCallback((sr: any) => {
    setExistingId(sr.id ?? null);
    setForm(prev => ({
      ...prev,
      serviceDate: sr.serviceDate || prev.serviceDate,
      serviceType: sr.serviceType || prev.serviceType,
      time: sr.time || '',
      mcMemberId: sr.mcMemberId || '',
      mcName: sr.mcName || '',
      sermonTopic: sr.sermonTopic || '',
      scriptureEnglish: sr.scriptureEnglish || '',
      scriptureTwi: sr.scriptureTwi || '',
      preacherMemberId: sr.preacherMemberId || '',
      preacherName: sr.preacherName || '',
    }));
    if (sr.programme?.length) setProgramme(sr.programme);
    if (sr.officiators?.length) {
      setOfficiators(Array.from({ length: 6 }, (_, i) => {
        const found = sr.officiators.find((o: any) => o.slot === i + 1);
        return found ? { slot: found.slot, memberId: found.memberId || '', memberName: found.memberName || '' } : { slot: i + 1, memberId: '', memberName: '' };
      }));
    }
    setDirty(false);
  }, []);

  // Editing an existing setup: start from the saved copy so it opens offline.
  useEffect(() => {
    if (!id) return;
    loadCachedServiceSetups().then(list => {
      const found = list?.find(s => s.id === id);
      if (found) apply(found);
    });
  }, [id, apply]);

  // As the date or type change, load any setup that already exists for that service (as the web form does).
  useEffect(() => {
    if (skipNextLookup.current) {
      skipNextLookup.current = false;
      return;
    }
    if (!form.serviceDate || !form.serviceType) return;
    const timer = setTimeout(async () => {
      try {
        const sr: any = await api.serviceSetups.getByDate(form.serviceDate, form.serviceType);
        if (sr && sr.id) apply(sr);
      } catch (err: any) {
        if (err?.status === 404) {
          setExistingId(null);
          setForm(prev => ({ ...prev, time: '', mcMemberId: '', mcName: '', sermonTopic: '', scriptureEnglish: '', scriptureTwi: '', preacherMemberId: '', preacherName: '' }));
          setProgramme(DEFAULT_PROGRAMME.map(r => ({ ...r })));
          setOfficiators(emptyOfficiators());
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.serviceDate, form.serviceType, apply]);

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    const sub = (navigation as any).addListener('beforeRemove', (e: any) => {
      if (!dirty || saving) return;
      e.preventDefault();
      Alert.alert('Discard changes?', 'You have unsaved changes. Are you sure you want to go back?', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return sub;
  }, [navigation, dirty, saving]);

  const change = (patch: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };
  const changeRow = (index: number, patch: Partial<ProgrammeRow>) => {
    setProgramme(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const changeOfficiator = (index: number, memberId: string | undefined, memberName: string) => {
    setOfficiators(prev => prev.map((o, i) => (i === index ? { ...o, memberId: memberId || '', memberName } : o)));
    setDirty(true);
  };

  const buildPayload = () => ({
    ...form,
    mcMemberId: clean(form.mcMemberId),
    preacherMemberId: clean(form.preacherMemberId),
    programme: programme.map(p => ({ ...p, assignedMemberId: clean(p.assignedMemberId) })),
    officiators: officiators.filter(o => o.memberName).map(o => ({ ...o, memberId: clean(o.memberId) })),
  });

  const finish = (message: string) => {
    setDirty(false);
    toast.show({ title: message, tone: 'success' });
    // The dirty flag is cleared before leaving so the discard prompt does not appear.
    setTimeout(() => router.back(), 0);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (existingId) {
        await api.serviceSetups.update(existingId, buildPayload());
        finish('Service setup updated');
      } else {
        await api.serviceSetups.create(buildPayload());
        finish('Service setup created');
      }
    } catch (err: any) {
      if (err?.status === 409) {
        Alert.alert(
          'Setup already exists',
          `A service setup for ${form.serviceDate} (${form.serviceType}) already exists. Overwrite it with these details?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Overwrite', style: 'destructive', onPress: overwrite },
          ]
        );
      } else {
        toast.show({ title: 'Failed to save service setup', message: 'Check your connection and try again.', tone: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const overwrite = async () => {
    setSaving(true);
    try {
      const sr: any = await api.serviceSetups.getByDate(form.serviceDate, form.serviceType);
      await api.serviceSetups.update(sr.id, buildPayload());
      finish('Service setup overwritten');
    } catch {
      toast.show({ title: 'Failed to overwrite setup', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const pdf = async (mode: 'preview' | 'share') => {
    try {
      if (mode === 'preview') await previewServiceSetupPdf(form, programme, officiators);
      else await shareServiceSetupPdf(form, programme, officiators);
    } catch (err) {
      console.error('Service setup PDF failed:', err);
      toast.show({ title: mode === 'preview' ? 'Failed to preview PDF' : 'Failed to generate PDF', tone: 'error' });
    }
  };

  return (
    <Screen>
      <AppHeader
        title="Service setup"
        subtitle={existingId ? 'Edit this service setup' : 'Plan an order of service'}
        showBack
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon={Eye} label="Preview PDF" onPress={() => pdf('preview')} />
            <IconButton icon={Download} label="Download PDF" onPress={() => pdf('share')} />
          </View>
        }
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
          <Section title="Setup details">
            <View style={{ padding: space.md, gap: space.md }}>
              <NativeDatePicker label="Service date" required value={form.serviceDate} onChange={v => change({ serviceDate: v })} />
              <TextField label="Time" value={form.time} onChangeText={v => change({ time: v })} placeholder="e.g. 09:30" keyboardType="numbers-and-punctuation" />
              <FieldGroup label="Service type">
                <ChoiceChips options={serviceTypes} value={form.serviceType} onChange={v => change({ serviceType: v })} />
              </FieldGroup>
              <MemberNameField
                label="Master of ceremonies (MC)"
                value={form.mcName}
                memberId={form.mcMemberId || undefined}
                members={members}
                onChange={(memberId, name) => change({ mcMemberId: memberId || '', mcName: name })}
              />
              <TextField label="Sermon topic" value={form.sermonTopic} onChangeText={v => change({ sermonTopic: v })} placeholder="Topic of the sermon…" />
              <TextField label="Scripture (English)" value={form.scriptureEnglish} onChangeText={v => change({ scriptureEnglish: v })} placeholder="e.g. John 3:16" />
              <TextField label="Scripture (Twi)" value={form.scriptureTwi} onChangeText={v => change({ scriptureTwi: v })} placeholder="e.g. Yohane 3:16" />
              <MemberNameField
                label="Preacher"
                value={form.preacherName}
                memberId={form.preacherMemberId || undefined}
                members={members}
                onChange={(memberId, name) => change({ preacherMemberId: memberId || '', preacherName: name })}
              />
            </View>
          </Section>

          <Section title="Order of service (programme)">
            <View style={{ gap: space.sm, padding: space.sm }}>
              {programme.map((row, i) => (
                <Surface key={i} style={{ gap: space.sm }}>
                  <AppText variant="bodyStrong">{i + 1}. {row.activity}</AppText>
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <View style={{ flex: 1 }}>
                      <TextField label="Start" value={row.startTime} onChangeText={v => changeRow(i, { startTime: v })} placeholder="09:30" keyboardType="numbers-and-punctuation" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextField label="End" value={row.endTime} onChangeText={v => changeRow(i, { endTime: v })} placeholder="09:35" keyboardType="numbers-and-punctuation" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextField label="Duration" value={row.duration} onChangeText={v => changeRow(i, { duration: v })} placeholder="5 min" />
                    </View>
                  </View>
                  <MemberNameField
                    label="Assigned person"
                    value={row.assignedMemberName}
                    memberId={row.assignedMemberId || undefined}
                    members={members}
                    onChange={(memberId, name) => changeRow(i, { assignedMemberId: memberId || '', assignedMemberName: name })}
                  />
                </Surface>
              ))}
            </View>
          </Section>

          <Section title="Officiators" footer="Acts 2:38 — Repent and be baptized">
            <View style={{ padding: space.md, gap: space.md }}>
              {officiators.map((o, i) => (
                <MemberNameField
                  key={o.slot}
                  label={`Slot ${o.slot}`}
                  value={o.memberName}
                  memberId={o.memberId || undefined}
                  members={members}
                  onChange={(memberId, name) => changeOfficiator(i, memberId, name)}
                />
              ))}
            </View>
          </Section>
        </ScrollView>
        <SaveBar label={saving ? 'Saving…' : 'Save setup'} loading={saving} disabled={saving || !dirty} onPress={save} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
