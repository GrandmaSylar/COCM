import React, { useState, useEffect, useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Calendar, Check, Hash, Lock, RefreshCw, Settings, Unlock, UserCheck } from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import {
  getLocalAttendanceRecords,
  getLocalCustomServices,
  upsertLocalAttendanceRecord,
  LocalAttendanceRecord,
  LocalCustomService
} from '../../lib/db';
import { syncCustomServices, syncAttendanceRecords } from '../../lib/syncEngine';
import { generateUUID } from '../../lib/uuid';
import { api } from '../../lib/api';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonList } from '../../components/Skeleton';
import {
  AppText, Badge, Button, EmptyState, IconButton, IconWell, ListRow, PressableScale, Screen, SearchField, Section,
  SegmentedControl, Sheet, Surface,
} from '../../components/ui';
import { enterUp } from '../../theme/animations';
import { haptic } from '../../theme/haptics';
import { radius, space } from '../../theme/tokens';

const SUNDAY_MAIN_SERVICE = 'Sunday Main Service';

export default function AttendanceDashboardScreen() {
  const router = useRouter();
  const c = useAppColors();

  const [records, setRecords] = useState<LocalAttendanceRecord[]>([]);
  const [customServices, setCustomServices] = useState<LocalCustomService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState('all');
  const [selectedAttendanceType, setSelectedAttendanceType] = useState('all');

  // Session Launcher Modal State
  const [showLauncher, setShowLauncher] = useState(false);
  const [launchServiceType, setLaunchServiceType] = useState(SUNDAY_MAIN_SERVICE);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([syncCustomServices(), syncAttendanceRecords()]).catch(() => {});
      const recs = await getLocalAttendanceRecords();
      setRecords(recs);
      const svcs = await getLocalCustomServices();
      setCustomServices(svcs);
    } catch (err) {
      console.error('Failed to load attendance dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Launch New Live Individual Attendance Session
  const handleStartLiveSession = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      let sessionId = generateUUID();

      try {
        const res = await api.attendance.getOrCreate({
          date: today,
          serviceType: launchServiceType,
          startTime: '08:00',
          endTime: '13:00'
        });
        if (res && res.id) {
          sessionId = res.id;
        }
      } catch (err) {
        console.warn('Backend getOrCreate warning (saving locally):', err);
      }

      const newSession: LocalAttendanceRecord = {
        id: sessionId,
        date: today,
        service_type: launchServiceType,
        start_time: '08:00',
        end_time: '13:00',
        total_count: 0,
        status: 'live',
        attendance_type: 'individual',
        is_custom_service: launchServiceType !== SUNDAY_MAIN_SERVICE ? 1 : 0,
        created_at: new Date().toISOString(),
      };

      await upsertLocalAttendanceRecord(newSession);
      setShowLauncher(false);
      router.push(`/attendance/live/${sessionId}` as any);
    } catch (err) {
      console.error('Failed to launch live session:', err);
    }
  };

  // 12-Hour Edit Window calculation
  const getEditWindowInfo = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const twelveHours = 12 * 60 * 60 * 1000;
    const remaining = Math.max(0, twelveHours - (now - created));

    if (remaining > 0) {
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      return { canEdit: true, label: `${hours}h ${minutes}m left` };
    }
    return { canEdit: false, label: 'Locked' };
  };

  // Separate live vs completed records
  const liveSessions = records.filter(r => r.status === 'live');
  const finalizedRecords = records.filter(r => r.status !== 'live');

  // Filter finalized records
  const filteredRecords = finalizedRecords.filter(record => {
    const matchesSearch = record.service_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesService = selectedServiceType === 'all' || record.service_type === selectedServiceType;
    const matchesType = selectedAttendanceType === 'all' || record.attendance_type === selectedAttendanceType;
    return matchesSearch && matchesService && matchesType;
  });

  // Calculate statistics
  const totalServices = records.length;
  const averageAttendance = records.length > 0
    ? Math.round(records.reduce((sum, r) => sum + (r.total_count || 0), 0) / records.length)
    : 0;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeekAttendance = records
    .filter(r => new Date(r.date) >= weekAgo)
    .reduce((sum, r) => sum + (r.total_count || 0), 0);

  const availableServiceTypes = Array.from(new Set([
    SUNDAY_MAIN_SERVICE,
    ...customServices.filter(s => s.is_active === 1 && s.name !== SUNDAY_MAIN_SERVICE).map(s => s.name)
  ]));

  const fmtDate = (d: string) => {
    const date = new Date(d);
    return isNaN(date.getTime()) ? d : date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <Screen>
      <AppHeader
        title="Attendance"
        subtitle="Service registers and live check-in"
        showBack
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon={RefreshCw} label="Refresh" spinning={refreshing} onPress={handleRefresh} />
            <IconButton icon={Settings} label="Manage services" onPress={() => router.push('/attendance/services' as any)} />
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Live sessions */}
        {liveSessions.map(session => (
          <Animated.View key={session.id} entering={enterUp()}>
            <Surface style={{ gap: space.sm, borderColor: c.success.base, borderWidth: 1.5, backgroundColor: c.success.soft }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <LiveDot />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>{session.service_type}</AppText>
                  <AppText variant="caption" tone="muted">{session.total_count || 0} checked in so far</AppText>
                </View>
                <Badge label="Live" tone="success" />
              </View>
              <Button label="Join session" icon={UserCheck} fullWidth onPress={() => router.push(`/attendance/live/${session.id}` as any)} />
            </Surface>
          </Animated.View>
        ))}

        {/* Ways to record */}
        <Animated.View entering={enterUp(40)} style={{ flexDirection: 'row', gap: space.xs }}>
          <ActionTile icon={UserCheck} title="Check in members" subtitle="Live, one by one" onPress={() => setShowLauncher(true)} />
          <ActionTile icon={Hash} title="Record head count" subtitle="Men, women, children" onPress={() => router.push('/attendance/record-general' as any)} />
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={enterUp(80)} style={{ flexDirection: 'row', borderRadius: radius.md, backgroundColor: c.surfaceMuted, paddingVertical: space.sm }}>
          {[
            { label: 'Services', value: totalServices },
            { label: 'Average', value: averageAttendance },
            { label: 'Last 7 days', value: thisWeekAttendance },
          ].map((m, i) => (
            <View key={m.label} style={{ flex: 1, alignItems: 'center', gap: 2, borderLeftWidth: i ? 1 : 0, borderLeftColor: c.border }}>
              <AppText variant="headline" numeric>{m.value.toLocaleString()}</AppText>
              <AppText variant="caption" tone="muted">{m.label}</AppText>
            </View>
          ))}
        </Animated.View>

        {/* Registers */}
        <View style={{ gap: space.sm }}>
          <SearchField value={searchTerm} onChangeText={setSearchTerm} placeholder="Search by service" />
          <SegmentedControl
            accessibilityLabel="Attendance type"
            value={selectedAttendanceType as 'all' | 'individual' | 'general'}
            onChange={setSelectedAttendanceType}
            options={[
              { value: 'all', label: 'All' },
              { value: 'individual', label: 'Check-in' },
              { value: 'general', label: 'Head count' },
            ]}
          />
        </View>

        <Section title={`Registers · ${filteredRecords.length}`} bare>
          {loading ? (
            <SkeletonList count={4} hasAvatar={false} />
          ) : filteredRecords.length === 0 ? (
            <Surface>
              <EmptyState
                icon={Calendar}
                title={records.length ? 'No registers match' : 'No registers yet'}
                message={records.length ? 'Try a different search or type.' : 'Start a live check-in or record a head count after a service.'}
              />
            </Surface>
          ) : (
            <Surface padded={false}>
              {filteredRecords.map((record, i) => {
                const editInfo = getEditWindowInfo(record.created_at);
                const isGeneral = record.attendance_type === 'general';
                return (
                  <View key={record.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                    <ListRow
                      icon={isGeneral ? Hash : UserCheck}
                      iconTone={isGeneral ? 'info' : 'primary'}
                      title={record.service_type}
                      subtitle={fmtDate(record.date)}
                      right={
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <AppText variant="headline" numeric>{record.total_count}</AppText>
                          <Badge
                            label={editInfo.canEdit ? editInfo.label : 'Locked'}
                            tone={editInfo.canEdit ? 'success' : 'neutral'}
                            icon={editInfo.canEdit ? Unlock : Lock}
                          />
                        </View>
                      }
                    />
                  </View>
                );
              })}
            </Surface>
          )}
        </Section>
      </ScrollView>

      {/* Live session launcher */}
      <Sheet
        visible={showLauncher}
        onClose={() => setShowLauncher(false)}
        title="Start live check-in"
        subtitle="Choose the service for today’s check-in"
        footer={<Button label="Start session" icon={UserCheck} fullWidth onPress={handleStartLiveSession} />}
      >
        <Surface padded={false}>
          {availableServiceTypes.map((st, i) => {
            const selected = launchServiceType === st;
            return (
              <Pressable
                key={st}
                onPress={() => { haptic.selection(); setLaunchServiceType(st); }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.md, gap: space.sm,
                  borderTopWidth: i ? 1 : 0, borderTopColor: c.border,
                  backgroundColor: pressed ? c.surfaceMuted : 'transparent',
                })}
              >
                <AppText variant={selected ? 'bodyStrong' : 'bodyMedium'} style={{ flex: 1 }}>{st}</AppText>
                {selected ? <Check size={20} color={c.primary.text} /> : null}
              </Pressable>
            );
          })}
        </Surface>
      </Sheet>
    </Screen>
  );
}

function ActionTile({ icon, title, subtitle, onPress }: { icon: any; title: string; subtitle: string; onPress: () => void }) {
  const c = useAppColors();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={{ flex: 1, gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, minHeight: 112 }}
    >
      <IconWell icon={icon} tone="primary" size={40} />
      <View style={{ gap: 2 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" tone="muted">{subtitle}</AppText>
      </View>
    </PressableScale>
  );
}

/** Small pulsing dot for live sessions (static with Reduce Motion). */
function LiveDot() {
  const c = useAppColors();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!reduceMotion) scale.value = withRepeat(withTiming(1.8, { duration: 1100 }), -1, false);
  }, [reduceMotion]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: 2 - scale.value }));
  return (
    <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: c.success.base }, ring]} />
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.success.base }} />
    </View>
  );
}
