import React, { useState, useEffect } from 'react';
import { Alert as RNAlert, ScrollView, Switch, View } from 'react-native';
import { Calendar, Clock, Plus, Trash2 } from '@tamagui/lucide-icons';
import {
  getLocalCustomServices,
  upsertLocalCustomService,
  toggleLocalCustomService,
  deleteLocalCustomService,
  LocalCustomService
} from '../../../lib/db';
import { generateUUID } from '../../../lib/uuid';
import { pushOrQueue, syncCustomServices } from '../../../lib/syncEngine';
import { toServicePayload } from '../../../lib/syncPayloads';
import { useAppColors } from '../../../context/ThemeContext';
import { AppHeader } from '../../../components/AppHeader';
import { SkeletonList } from '../../../components/Skeleton';
import {
  AppText, Badge, Button, ChoiceChips, EmptyState, FieldGroup, IconButton, ListRow, Screen, Section, Sheet, TextField, useToast,
} from '../../../components/ui';
import { haptic } from '../../../theme/haptics';
import { space } from '../../../theme/tokens';

const SUNDAY_MAIN_SERVICE = {
  name: 'Sunday Main Service',
  description: 'Every Sunday of the week [8am - 1pm]',
  startTime: '08:00',
  endTime: '13:00',
  isPermanent: true
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ServicesManagerScreen() {
  const [customServices, setCustomServices] = useState<LocalCustomService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formErrors, setFormErrors] = useState<{ name?: string; days?: string; time?: string }>({});
  const toast = useToast();
  const c = useAppColors();

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('2099-12-31');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([0]); // default Sunday

  const loadServices = async () => {
    setLoading(true);
    try {
      await syncCustomServices().catch(() => {});
      const svcs = await getLocalCustomServices();
      setCustomServices(svcs);
    } catch (e) {
      console.error('Failed to load custom services:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleDayToggle = (dayIndex: number) => {
    setSelectedDays(prev =>
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort()
    );
  };

  const handleAddService = async () => {
    const nextErrors = {
      name: name.trim() ? undefined : 'Enter a service name.',
      days: selectedDays.length ? undefined : 'Choose at least one day.',
      time: startTime && endTime ? undefined : 'Enter start and end times.',
    };
    setFormErrors(nextErrors);
    if (nextErrors.name || nextErrors.days || nextErrors.time || !startDate || !endDate) return;

    const newSvc: LocalCustomService = {
      id: generateUUID(),
      name: name.trim(),
      description: description.trim() || undefined,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      days_of_week: JSON.stringify(selectedDays),
      is_active: 1,
      created_at: new Date().toISOString(),
    };

    try {
      await upsertLocalCustomService(newSvc);
      await pushOrQueue('POST', '/services', toServicePayload(newSvc));
      setName('');
      setDescription('');
      setShowAddForm(false);
      toast.show({ title: 'Service added', message: newSvc.name });
      loadServices();
    } catch (err: any) {
      console.error('Failed to save custom service:', err);
      toast.show({ title: 'Couldn’t save service', message: err?.message, tone: 'error' });
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const svc = customServices.find(s => s.id === id);
      await toggleLocalCustomService(id);
      if (svc) {
        await pushOrQueue('PUT', `/services/${id}`, { is_active: !svc.is_active });
      }
      loadServices();
    } catch (err) {
      console.error('Failed to toggle service:', err);
    }
  };

  const handleDelete = async (id: string, serviceName: string) => {
    RNAlert.alert(
      'Delete service?',
      `"${serviceName}" will no longer be available for attendance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLocalCustomService(id);
              await pushOrQueue('DELETE', `/services/${id}`);
            } catch (err: any) {
              toast.show({ title: 'Couldn’t delete service', message: err?.message, tone: 'error' });
            }
            loadServices();
          }
        }
      ]
    );
  };

  return (
    <Screen>
      <AppHeader
        title="Services"
        subtitle="Service types for attendance"
        showBack
        rightElement={<IconButton icon={Plus} label="Add service" tone="primary" onPress={() => { setFormErrors({}); setShowAddForm(true); }} />}
      />

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xl }}>
        <Section title="Permanent">
          <ListRow
            icon={Clock}
            title={SUNDAY_MAIN_SERVICE.name}
            subtitle={`Every Sunday · ${SUNDAY_MAIN_SERVICE.startTime}–${SUNDAY_MAIN_SERVICE.endTime}`}
            right={<Badge label="Always on" tone="success" />}
          />
        </Section>

        <Section
          title={`Custom services · ${customServices.length}`}
          action={<Button label="Add" icon={Plus} size="sm" variant="soft" onPress={() => { setFormErrors({}); setShowAddForm(true); }} />}
        >
          {loading ? (
            <View style={{ padding: space.md }}><SkeletonList count={3} hasAvatar={false} /></View>
          ) : customServices.length === 0 ? (
            <EmptyState icon={Calendar} title="No custom services" message="Add mid-week, youth or special services to track their attendance." />
          ) : (
            customServices.map(item => {
              let daysArr: number[] = [];
              try { daysArr = JSON.parse(item.days_of_week || '[]'); } catch {}
              const daysText = daysArr.map(d => DAY_NAMES[d]?.slice(0, 3)).join(', ');
              const isActive = item.is_active === 1;
              return (
                <ListRow
                  key={item.id}
                  icon={Calendar}
                  iconTone={isActive ? 'primary' : 'neutral'}
                  title={item.name}
                  subtitle={[item.description, `${daysText} · ${item.start_time}–${item.end_time}`].filter(Boolean).join('\n')}
                  right={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Switch
                        value={isActive}
                        onValueChange={() => { haptic.selection(); handleToggle(item.id); }}
                        trackColor={{ true: c.primary.base, false: c.borderStrong }}
                        thumbColor="#FFFFFF"
                        accessibilityLabel={`${item.name} active`}
                      />
                      <IconButton icon={Trash2} label={`Delete ${item.name}`} tone="danger" size={36} onPress={() => handleDelete(item.id, item.name)} />
                    </View>
                  }
                />
              );
            })
          )}
        </Section>
      </ScrollView>

      <Sheet
        visible={showAddForm}
        onClose={() => setShowAddForm(false)}
        title="New service"
        footer={<Button label="Save service" fullWidth onPress={handleAddService} />}
      >
        <TextField
          label="Service name *"
          placeholder="e.g. Mid-week revival"
          value={name}
          onChangeText={t => { setName(t); if (formErrors.name) setFormErrors(e => ({ ...e, name: undefined })); }}
          error={formErrors.name}
        />
        <TextField label="Description" placeholder="Optional" value={description} onChangeText={setDescription} />
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          <View style={{ flex: 1 }}><TextField label="Starts" value={startTime} onChangeText={setStartTime} placeholder="09:00" keyboardType="numbers-and-punctuation" /></View>
          <View style={{ flex: 1 }}><TextField label="Ends" value={endTime} onChangeText={setEndTime} placeholder="12:00" keyboardType="numbers-and-punctuation" /></View>
        </View>
        {formErrors.time ? <AppText variant="caption" tone="danger">{formErrors.time}</AppText> : null}
        <FieldGroup label="Days *" error={formErrors.days}>
          <ChoiceChips
            options={DAY_NAMES.map((d, idx) => ({ value: String(idx), label: d.slice(0, 3) }))}
            value={selectedDays.map(String)}
            onChange={v => { handleDayToggle(Number(v)); if (formErrors.days) setFormErrors(e => ({ ...e, days: undefined })); }}
          />
        </FieldGroup>
      </Sheet>
    </Screen>
  );
}
