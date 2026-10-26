import React, { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { FileText, MapPin, Phone, UserCheck } from '@tamagui/lucide-icons';
import { upsertLocalVisitor } from '../../lib/db';
import { getChurchZones } from '../../lib/options';
import { pushOrQueue } from '../../lib/syncEngine';
import { toVisitorPayload } from '../../lib/syncPayloads';
import { generateUUID } from '../../lib/uuid';
import { NativeDatePicker } from '../../components/NativeDatePicker';
import { AppHeader } from '../../components/AppHeader';
import { ChoiceChips, FieldGroup, FormSection, SaveBar, Screen, TextField, useToast } from '../../components/ui';
import { space } from '../../theme/tokens';

export default function AddVisitorScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [residence, setResidence] = useState('');
  const [potentialZone, setPotentialZone] = useState('A');
  const [zonesList, setZonesList] = useState<string[]>(['A', 'B', 'F', 'K', 'M', 'R']);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    getChurchZones().then(z => {
      if (z.length > 0) setZonesList(z);
    }).catch(err => console.warn('Error fetching zones in AddVisitor:', err));
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameError('Enter the visitor’s name.');
      return;
    }
    setNameError(null);

    setSubmitting(true);
    try {
      const newId = generateUUID();
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      // 1. Instant 0ms SQLite local write
      await upsertLocalVisitor({
        id: newId,
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        visit_date: visitDate || today,
        potential_zone: potentialZone,
        follow_up_status: 'pending',
        notes: notes.trim() || undefined,
        raw_json: JSON.stringify({ residence: residence.trim() }),
        created_at: now
      });

      // 2. Server push; queued in the outbox only if the server can't be reached
      await pushOrQueue('POST', '/visitors', toVisitorPayload({
        id: newId,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        visit_date: visitDate || today,
        potential_zone: potentialZone,
        notes: notes.trim(),
        residence: residence.trim(),
      }));

      toast.show({ title: 'Visitor added', message: name.trim() });
      router.back();
    } catch (err: any) {
      console.error('Failed adding visitor:', err);
      toast.show({ title: 'Couldn’t save visitor', message: err?.message, tone: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="New visitor" subtitle="Log a first-time guest" showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xl, gap: space.md }} keyboardShouldPersistTaps="handled">
          <FormSection title="Visitor" icon={UserCheck} description="Who visited and when" state={name.trim() ? 'done' : 'needed'}>
            <TextField
              label="Full name *"
              value={name}
              onChangeText={t => { setName(t); if (nameError) setNameError(null); }}
              placeholder="e.g. Mary Mensah"
              autoCapitalize="words"
              error={nameError}
            />
            <NativeDatePicker label="Visit date" value={visitDate} onChange={setVisitDate} maxDate={new Date()} />
          </FormSection>

          <FormSection title="Contact" icon={Phone} description="How to follow up" state={phone || email ? 'done' : 'optional'}>
            <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="e.g. 0551 234 567" />
            <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="name@example.com" />
          </FormSection>

          <FormSection title="Location" icon={MapPin} description="Where they live" state={residence ? 'done' : 'optional'}>
            <TextField label="Residence" value={residence} onChangeText={setResidence} placeholder="e.g. Mataheko, Accra" />
            <FieldGroup label="Potential zone">
              <ChoiceChips options={zonesList.map(z => ({ value: z, label: `Zone ${z}` }))} value={potentialZone} onChange={setPotentialZone} />
            </FieldGroup>
          </FormSection>

          <FormSection title="Follow-up notes" icon={FileText} state={notes ? 'done' : 'optional'}>
            <TextField value={notes} onChangeText={setNotes} placeholder="e.g. First visit, invited by Deacon Kwame" multiline accessibilityLabel="Follow-up notes" />
          </FormSection>
        </ScrollView>
        <SaveBar label={submitting ? 'Saving…' : 'Save visitor'} loading={submitting} onPress={handleSubmit} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
