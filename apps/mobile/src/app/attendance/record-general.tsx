import React, { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { CalendarDays, Info, Users } from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import {
  getLocalCustomServices,
  upsertLocalAttendanceRecord,
  LocalAttendanceRecord
} from '../../lib/db';
import { generateUUID } from '../../lib/uuid';
import { pushOrQueue, syncCustomServices } from '../../lib/syncEngine';
import { toAttendancePayload } from '../../lib/syncPayloads';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { NativeDatePicker } from '../../components/NativeDatePicker';
import { AppText, ChoiceChips, FieldGroup, FormSection, SaveBar, Screen, TextField, useToast } from '../../components/ui';
import { radius, space } from '../../theme/tokens';

const SUNDAY_MAIN_SERVICE = 'Sunday Main Service';

export default function RecordGeneralAttendanceScreen() {
  const router = useRouter();
  const c = useAppColors();

  const [serviceType, setServiceType] = useState(SUNDAY_MAIN_SERVICE);
  const [availableServices, setAvailableServices] = useState<string[]>([SUNDAY_MAIN_SERVICE]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('13:00');

  // Demographic headcount breakdown
  const [menCount, setMenCount] = useState('0');
  const [womenCount, setWomenCount] = useState('0');
  const [childrenCount, setChildrenCount] = useState('0');
  const [visitorsCount, setVisitorsCount] = useState('0');
  const [totalCount, setTotalCount] = useState('');

  const [loading, setLoading] = useState(false);
  const [totalError, setTotalError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    async function loadServices() {
      try {
        await syncCustomServices().catch(() => {});
        const customSvcs = await getLocalCustomServices();
        const activeCustomNames = customSvcs
          .filter(s => s.is_active === 1 && s.name !== SUNDAY_MAIN_SERVICE)
          .map(s => s.name);
        setAvailableServices(Array.from(new Set([SUNDAY_MAIN_SERVICE, ...activeCustomNames])));
      } catch (err) {
        console.error('Failed to load custom services:', err);
      }
    }
    loadServices();
  }, []);

  // Recalculate suggested total when breakdown numbers change
  const handleBreakdownChange = (field: 'men' | 'women' | 'children' | 'visitors', val: string) => {
    const num = parseInt(val) || 0;
    let m = field === 'men' ? num : parseInt(menCount) || 0;
    let w = field === 'women' ? num : parseInt(womenCount) || 0;
    let c = field === 'children' ? num : parseInt(childrenCount) || 0;
    let v = field === 'visitors' ? num : parseInt(visitorsCount) || 0;

    if (field === 'men') setMenCount(val);
    if (field === 'women') setWomenCount(val);
    if (field === 'children') setChildrenCount(val);
    if (field === 'visitors') setVisitorsCount(val);

    const calcSum = m + w + c + v;
    if (calcSum > 0) {
      setTotalCount(calcSum.toString());
    }
  };

  const handleSave = async () => {
    const tot = parseInt(totalCount);
    if (!serviceType || isNaN(tot) || tot <= 0) {
      setTotalError('Enter a total greater than zero.');
      return;
    }
    setTotalError(null);

    setLoading(true);
    try {
      const rec: LocalAttendanceRecord = {
        id: generateUUID(),
        date,
        service_type: serviceType,
        start_time: startTime,
        end_time: endTime,
        total_count: tot,
        is_custom_service: serviceType !== SUNDAY_MAIN_SERVICE ? 1 : 0,
        status: 'finalized',
        attendance_type: 'general',
        men_count: parseInt(menCount) || 0,
        women_count: parseInt(womenCount) || 0,
        children_count: parseInt(childrenCount) || 0,
        visitors_count: parseInt(visitorsCount) || 0,
        created_at: new Date().toISOString(),
      };

      await upsertLocalAttendanceRecord(rec);
      await pushOrQueue('POST', '/attendance', toAttendancePayload(rec));

      toast.show({ title: 'Head count saved', message: `${serviceType} · ${tot} people` });
      if (router.canGoBack()) router.back();
      else router.replace('/attendance' as any);
    } catch (err) {
      console.error('Failed to save general headcount record:', err);
      toast.show({ title: 'Couldn’t save head count', message: 'Please try again.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, value: string, key: 'men' | 'women' | 'children' | 'visitors') => (
    <View style={{ flex: 1 }}>
      <TextField
        label={label}
        value={value}
        onChangeText={v => handleBreakdownChange(key, v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        selectTextOnFocus
      />
    </View>
  );

  return (
    <Screen>
      <AppHeader title="Head count" subtitle="Record totals for a service" showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xl, gap: space.md }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', gap: 10, padding: space.sm, borderRadius: radius.md, backgroundColor: c.info.soft }}>
            <Info size={18} color={c.info.text} />
            <AppText variant="caption" color={c.info.text} style={{ flex: 1 }}>
              Head counts record totals only. To mark individual members (which updates their status), use live check-in.
            </AppText>
          </View>

          <FormSection title="Service" icon={CalendarDays} state="done">
            <FieldGroup label="Service *">
              <ChoiceChips options={availableServices} value={serviceType} onChange={setServiceType} />
            </FieldGroup>
            <NativeDatePicker label="Date" required value={date} onChange={setDate} maxDate={new Date()} />
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              <View style={{ flex: 1 }}><TextField label="Start time" value={startTime} onChangeText={setStartTime} placeholder="08:00" keyboardType="numbers-and-punctuation" /></View>
              <View style={{ flex: 1 }}><TextField label="End time" value={endTime} onChangeText={setEndTime} placeholder="13:00" keyboardType="numbers-and-punctuation" /></View>
            </View>
          </FormSection>

          <FormSection title="Head count" icon={Users} description="The total fills in from the breakdown" state={parseInt(totalCount) > 0 ? 'done' : 'needed'}>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {field('Men', menCount, 'men')}
              {field('Women', womenCount, 'women')}
            </View>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {field('Children', childrenCount, 'children')}
              {field('Visitors', visitorsCount, 'visitors')}
            </View>
            <TextField
              label="Total attendance *"
              value={totalCount}
              onChangeText={v => { setTotalCount(v.replace(/[^0-9]/g, '')); if (totalError) setTotalError(null); }}
              keyboardType="number-pad"
              placeholder="0"
              error={totalError}
              helper="You can override the calculated total."
            />
          </FormSection>
        </ScrollView>
        <SaveBar label={loading ? 'Saving…' : `Save head count${parseInt(totalCount) > 0 ? ` · ${totalCount}` : ''}`} loading={loading} onPress={handleSave} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
