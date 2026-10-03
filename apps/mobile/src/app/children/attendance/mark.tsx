import React, { useEffect, useState, useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Baby, Check, UserCheck, X } from '@tamagui/lucide-icons';
import {
  LocalChild,
  getLocalChildren,
  saveLocalChildrenAttendanceRecord
} from '../../../lib/db';
import { pushOrQueue } from '../../../lib/syncEngine';
import { generateUUID } from '../../../lib/uuid';
import { useAppColors } from '../../../context/ThemeContext';
import { NativeDatePicker } from '../../../components/NativeDatePicker';
import { AppHeader } from '../../../components/AppHeader';
import { SkeletonList } from '../../../components/Skeleton';
import {
  AppText, Avatar, Button, Chip, EmptyState, PressableScale, SaveBar, Screen, SearchField, Surface, TextField, useToast,
} from '../../../components/ui';
import { radius, space } from '../../../theme/tokens';

export default function ChildrenMarkAttendanceScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useAppColors();

  const [serviceType, setServiceType] = useState('Sunday Main Service');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [children, setChildren] = useState<LocalChild[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, 'present' | 'absent' | 'unmarked'>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyUnmarked, setShowOnlyUnmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const localKids = await getLocalChildren();
        if (localKids && localKids.length > 0) {
          setChildren(localKids);
          const initial: Record<string, 'present' | 'absent' | 'unmarked'> = {};
          localKids.forEach(c => {
            initial[c.id] = 'unmarked';
          });
          setAttendanceStatus(initial);
        }
      } catch (err) {
        console.warn('Error loading children roster:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChildren();
  }, []);

  const calculateAge = (dobString?: string) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age >= 0 ? age : null;
  };

  const filteredChildren = useMemo(() => {
    return children.filter(c => {
      const matchesSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const status = attendanceStatus[c.id] || 'unmarked';
      const matchesUnmarked = !showOnlyUnmarked || status === 'unmarked';
      return matchesSearch && matchesUnmarked;
    });
  }, [children, searchQuery, showOnlyUnmarked, attendanceStatus]);

  const handleToggle = (childId: string, target: 'present' | 'absent') => {
    setAttendanceStatus(prev => ({
      ...prev,
      [childId]: prev[childId] === target ? 'unmarked' : target
    }));
  };

  const handleMarkAllPresent = () => {
    setAttendanceStatus(prev => {
      const next = { ...prev };
      filteredChildren.forEach(c => {
        next[c.id] = 'present';
      });
      return next;
    });
  };

  const handleClearAll = () => {
    setAttendanceStatus(prev => {
      const next = { ...prev };
      filteredChildren.forEach(c => {
        next[c.id] = 'unmarked';
      });
      return next;
    });
  };

  const totalPresent = Object.values(attendanceStatus).filter(s => s === 'present').length;
  const totalAbsent = Object.values(attendanceStatus).filter(s => s === 'absent').length;
  const totalMarked = totalPresent + totalAbsent;
  const totalUnmarked = children.length - totalMarked;

  const handleSave = async () => {
    const presentIds = Object.entries(attendanceStatus)
      .filter(([_, s]) => s === 'present')
      .map(([id]) => id);

    const absentIds = Object.entries(attendanceStatus)
      .filter(([_, s]) => s === 'absent')
      .map(([id]) => id);

    if (presentIds.length === 0 && absentIds.length === 0) {
      toast.show({ title: 'Nothing marked yet', message: 'Mark at least one child present or absent.', tone: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const newRecordId = generateUUID();
      const now = new Date().toISOString();

      // 1. Save summary record to SQLite
      await saveLocalChildrenAttendanceRecord({
        id: newRecordId,
        service_date: serviceDate,
        service_type: serviceType,
        total_present: presentIds.length,
        total_members: children.length,
        marked_by: 'Mobile Admin',
        created_at: now
      });

      // 2. Server push; queued in the outbox only if the server can't be reached
      await pushOrQueue('POST', '/children/attendance', {
        id: newRecordId,
        date: serviceDate,
        serviceType,
        childMemberIds: presentIds,
        absentMemberIds: absentIds,
        visitorsCount: 0
      });

      toast.show({
        title: 'Attendance saved',
        message: `${presentIds.length} present, ${absentIds.length} absent of ${children.length}`,
      });
      router.back();
    } catch (err: any) {
      toast.show({ title: 'Couldn’t save attendance', message: err.message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const markedPct = children.length ? Math.round((totalMarked / children.length) * 100) : 0;

  return (
    <Screen>
      <AppHeader title="Children’s attendance" subtitle={serviceType} showBack />

      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, gap: space.sm }}>
        <Surface style={{ gap: space.sm }}>
          <TextField label="Service" value={serviceType} onChangeText={setServiceType} />
          <NativeDatePicker label="Date" value={serviceDate} onChange={setServiceDate} maxDate={new Date()} />
        </Surface>

        <View style={{ flexDirection: 'row', borderRadius: radius.md, backgroundColor: c.surfaceMuted, paddingVertical: space.xs }}>
          {[
            { label: 'Present', value: totalPresent, tone: 'success' as const },
            { label: 'Absent', value: totalAbsent, tone: 'danger' as const },
            { label: 'Unmarked', value: totalUnmarked, tone: 'subtle' as const },
            { label: 'Total', value: children.length, tone: 'default' as const },
          ].map((m, i) => (
            <View key={m.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: c.border }}>
              <AppText variant="headline" tone={m.tone} numeric>{m.value}</AppText>
              <AppText variant="micro" tone="muted">{m.label}</AppText>
            </View>
          ))}
        </View>

        <SearchField value={searchQuery} onChangeText={setSearchQuery} placeholder="Search children" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Button label="All present" icon={UserCheck} size="sm" variant="soft" onPress={handleMarkAllPresent} />
          <Button label="Clear" icon={X} size="sm" variant="secondary" onPress={handleClearAll} />
          <View style={{ flex: 1 }} />
          <Chip label="Unmarked only" selected={showOnlyUnmarked} onPress={() => setShowOnlyUnmarked(prev => !prev)} />
        </View>
      </View>

      {loading ? (
        <View style={{ padding: space.md }}><SkeletonList count={6} hasAvatar /></View>
      ) : (
        <FlatList
          data={filteredChildren}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space.md, paddingBottom: space.lg, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon={Baby}
              title={children.length ? 'No children match' : 'No children registered'}
              message={children.length ? 'Try a different search or show all.' : 'Add children to the registry before marking attendance.'}
            />
          }
          renderItem={({ item, index }) => {
            const status = attendanceStatus[item.id] || 'unmarked';
            const age = calculateAge(item.date_of_birth);
            const meta = [
              age !== null ? `${age} yrs` : null,
              item.gender ? (item.gender.toLowerCase() === 'male' ? 'Boy' : 'Girl') : null,
              item.zone ? `Zone ${item.zone}` : null,
            ].filter(Boolean).join(' · ');
            const first = index === 0;
            const last = index === filteredChildren.length - 1;
            return (
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: space.sm,
                  paddingHorizontal: space.md, paddingVertical: 10, minHeight: 64,
                  backgroundColor: status === 'present' ? c.success.soft : status === 'absent' ? c.danger.soft : c.surface,
                  borderColor: c.border, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopWidth: first ? 1 : 0,
                  borderTopLeftRadius: first ? radius.lg : 0, borderTopRightRadius: first ? radius.lg : 0,
                  borderBottomLeftRadius: last ? radius.lg : 0, borderBottomRightRadius: last ? radius.lg : 0,
                }}
              >
                <Avatar name={item.name} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>{item.name}</AppText>
                  {meta ? <AppText variant="caption" tone="muted" numberOfLines={1}>{meta}</AppText> : null}
                </View>
                <MarkToggle icon={Check} tone="success" selected={status === 'present'} label={`Mark ${item.name} present`} onPress={() => handleToggle(item.id, 'present')} />
                <MarkToggle icon={X} tone="danger" selected={status === 'absent'} label={`Mark ${item.name} absent`} onPress={() => handleToggle(item.id, 'absent')} />
              </View>
            );
          }}
        />
      )}

      <SaveBar
        label={saving ? 'Saving…' : `Save · ${totalPresent} present, ${totalAbsent} absent`}
        loading={saving}
        onPress={handleSave}
        progress={markedPct}
        hint={`${totalMarked} of ${children.length} marked`}
      />
    </Screen>
  );
}

function MarkToggle({ icon: Icon, tone, selected, label, onPress }: { icon: any; tone: 'success' | 'danger'; selected: boolean; label: string; onPress: () => void }) {
  const c = useAppColors();
  const t = tone === 'success' ? c.success : c.danger;
  return (
    <PressableScale
      onPress={onPress}
      haptics="selection"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={{
        width: 44, height: 44, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: selected ? t.base : c.surface,
        borderWidth: selected ? 0 : 1, borderColor: c.borderStrong,
      }}
    >
      <Icon size={20} color={selected ? t.on : t.text} />
    </PressableScale>
  );
}
