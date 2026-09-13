import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, TouchableOpacity, Alert as RNAlert, Modal } from 'react-native';
import { YStack, XStack, Text, Card, Button, Input, Spinner } from 'tamagui';
import {
  Calendar,
  Users,
  Plus,
  TrendingUp,
  Search,
  Clock,
  Settings,
  UserCheck,
  Lock,
  Unlock,
  RefreshCw,
  ArrowRight,
  Eye,
  Check,
  X
} from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
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

const SUNDAY_MAIN_SERVICE = 'Sunday Main Service';

export default function AttendanceDashboardScreen() {
  const router = useRouter();

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top', 'left', 'right']}>
      <YStack flex={1} backgroundColor="$background">
      {/* Header Bar */}
      <YStack px="$4" py="$3" borderBottomWidth={1} borderColor="$borderColor" space="$2">
        <XStack justifyContent="space-between" alignItems="center">
          <YStack>
            <Text color="$color" fontSize={20} fontWeight="900">Attendance</Text>
            <Text color="$colorPress" fontSize={12}>Track and manage service attendance</Text>
          </YStack>

          <TouchableOpacity onPress={handleRefresh}>
            <YStack p="$2" borderRadius="$3" backgroundColor="$borderColor" opacity={0.8}>
              <RefreshCw size={16} color="$color" className={refreshing ? 'animate-spin' : ''} />
            </YStack>
          </TouchableOpacity>
        </XStack>

        {/* Top Action Buttons (Single Row 3-Grid Fit) */}
        <XStack space="$1.5" width="100%">
          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/attendance/services' as any)}>
            <XStack backgroundColor="$background" borderWidth={1} borderColor="$borderColor" px="$1.5" py="$2" borderRadius="$3" space="$1" alignItems="center" justifyContent="center">
              <Settings size={13} color="$color" />
              <Text color="$color" fontSize={11} fontWeight="800" numberOfLines={1}>Services</Text>
            </XStack>
          </TouchableOpacity>

          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowLauncher(true)}>
            <XStack backgroundColor="rgba(0, 122, 255, 0.15)" borderWidth={1} borderColor="rgba(0, 122, 255, 0.3)" px="$1.5" py="$2" borderRadius="$3" space="$1" alignItems="center" justifyContent="center">
              <UserCheck size={13} color="#007AFF" />
              <Text color="#007AFF" fontSize={11} fontWeight="800" numberOfLines={1}>Individual</Text>
            </XStack>
          </TouchableOpacity>

          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push('/attendance/record-general' as any)}>
            <XStack backgroundColor="#FF9500" px="$1.5" py="$2" borderRadius="$3" space="$1" alignItems="center" justifyContent="center">
              <Plus size={13} color="white" />
              <Text color="white" fontSize={11} fontWeight="800" numberOfLines={1}>Head Count</Text>
            </XStack>
          </TouchableOpacity>
        </XStack>
      </YStack>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <YStack space="$4">

          {/* Active Live Session Alert Banner */}
          {liveSessions.map(session => (
            <Card key={session.id} p="$4" borderRadius="$4" borderWidth={1.5} borderColor="#34C759" backgroundColor="rgba(52, 199, 89, 0.08)">
              <XStack justifyContent="space-between" alignItems="center">
                <XStack space="$3" alignItems="center" flex={1}>
                  <YStack p="$2.5" borderRadius="$3" backgroundColor="rgba(52, 199, 89, 0.2)">
                    <Users size={22} color="#34C759" />
                  </YStack>
                  <YStack flex={1}>
                    <XStack space="$2" alignItems="center">
                      <Text color="$color" fontSize={15} fontWeight="800">{session.service_type}</Text>
                      <XStack backgroundColor="#34C759" px="$2" py="$0.5" borderRadius="$2">
                        <Text color="white" fontSize={10} fontWeight="900">LIVE SESSION</Text>
                      </XStack>
                    </XStack>
                    <Text color="$colorPress" fontSize={12}>{session.total_count || 0} marked present so far</Text>
                  </YStack>
                </XStack>

                <Button backgroundColor="#34C759" size="$3" onPress={() => router.push(`/attendance/live/${session.id}` as any)}>
                  <XStack space="$1" alignItems="center">
                    <UserCheck size={14} color="white" />
                    <Text color="white" fontWeight="800" fontSize={12}>Join Session</Text>
                  </XStack>
                </Button>
              </XStack>
            </Card>
          ))}

          {/* Stats Summary Cards */}
          <XStack space="$2">
            <Card flex={1} p="$3" borderRadius="$4" borderWidth={1} borderColor="rgba(0, 122, 255, 0.3)" backgroundColor="rgba(0, 122, 255, 0.08)">
              <Calendar size={18} color="#007AFF" />
              <Text color="$color" fontSize={22} fontWeight="900" marginTop="$1">{totalServices}</Text>
              <Text color="$colorPress" fontSize={11} fontWeight="700">Total Services</Text>
            </Card>

            <Card flex={1} p="$3" borderRadius="$4" borderWidth={1} borderColor="rgba(52, 199, 89, 0.3)" backgroundColor="rgba(52, 199, 89, 0.08)">
              <Users size={18} color="#34C759" />
              <Text color="$color" fontSize={22} fontWeight="900" marginTop="$1">{averageAttendance}</Text>
              <Text color="$colorPress" fontSize={11} fontWeight="700">Avg Attendance</Text>
            </Card>

            <Card flex={1} p="$3" borderRadius="$4" borderWidth={1} borderColor="rgba(255, 149, 0, 0.3)" backgroundColor="rgba(255, 149, 0, 0.08)">
              <TrendingUp size={18} color="#FF9500" />
              <Text color="$color" fontSize={22} fontWeight="900" marginTop="$1">{thisWeekAttendance}</Text>
              <Text color="$colorPress" fontSize={11} fontWeight="700">This Week</Text>
            </Card>
          </XStack>

          {/* Search & Mode Filters */}
          <YStack space="$2">
            <XStack px="$3" py="$2" borderRadius="$3" borderWidth={1} borderColor="$borderColor" backgroundColor="$background" alignItems="center" space="$2">
              <Search size={16} color="#8E8E93" />
              <Input
                placeholder="Search service records..."
                placeholderTextColor="#8E8E93"
                value={searchTerm}
                onChangeText={setSearchTerm}
                backgroundColor="transparent"
                borderWidth={0}
                flex={1}
                size="$2"
              />
            </XStack>

            <XStack space="$2">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                {(['all', 'individual', 'general'] as const).map(type => {
                  const isSelected = selectedAttendanceType === type;
                  return (
                    <TouchableOpacity key={type} onPress={() => setSelectedAttendanceType(type)}>
                      <YStack
                        px="$3"
                        py="$1.5"
                        borderRadius="$3"
                        borderWidth={1}
                        borderColor={isSelected ? '#FF9500' : '$borderColor'}
                        backgroundColor={isSelected ? 'rgba(255, 149, 0, 0.15)' : '$background'}
                      >
                        <Text color={isSelected ? '#FF9500' : '$colorPress'} fontSize={11} fontWeight={isSelected ? '800' : '600'} textTransform="uppercase">
                          {type === 'all' ? 'All Types' : type === 'individual' ? 'Individual' : 'Head Count'}
                        </Text>
                      </YStack>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </XStack>
          </YStack>

          {/* Historical Registers List */}
          <YStack space="$2">
            <Text color="$color" fontSize={14} fontWeight="800" textTransform="uppercase" letterSpacing={0.5}>
              Recent Service Registers ({filteredRecords.length})
            </Text>

            {loading ? (
              <Spinner size="large" color="#FF9500" py="$6" />
            ) : filteredRecords.length === 0 ? (
              <Card p="$5" borderRadius="$4" borderWidth={1} borderColor="$borderColor" alignItems="center">
                <Calendar size={28} color="#8E8E93" />
                <Text color="$color" fontSize={14} fontWeight="800" marginTop="$2">No Service Records Found</Text>
                <Text color="$colorPress" fontSize={12} textAlign="center" marginTop="$1">
                  Tap "Mark Individual" to start a live session or "Record Head Count" to enter aggregate figures.
                </Text>
              </Card>
            ) : (
              filteredRecords.map(record => {
                const editInfo = getEditWindowInfo(record.created_at);
                const isGeneral = record.attendance_type === 'general';

                return (
                  <Card key={record.id} p="$3.5" borderRadius="$4" borderWidth={1} borderColor="$borderColor" backgroundColor="$background">
                    <XStack justifyContent="space-between" alignItems="center">
                      <XStack space="$3" alignItems="center" flex={1}>
                        <YStack p="$2" borderRadius="$3" backgroundColor={isGeneral ? 'rgba(0, 122, 255, 0.15)' : 'rgba(255, 149, 0, 0.15)'}>
                          <Calendar size={20} color={isGeneral ? '#007AFF' : '#FF9500'} />
                        </YStack>
                        <YStack flex={1}>
                          <Text color="$color" fontSize={14} fontWeight="800">{record.service_type}</Text>
                          <XStack space="$1.5" alignItems="center" marginTop="$0.5">
                            <XStack backgroundColor={isGeneral ? 'rgba(0, 122, 255, 0.15)' : 'rgba(255, 149, 0, 0.15)'} px="$2" py="$0.5" borderRadius="$2">
                              <Text color={isGeneral ? '#007AFF' : '#FF9500'} fontSize={10} fontWeight="800">
                                {isGeneral ? 'Head Count' : 'Individual'}
                              </Text>
                            </XStack>

                            <XStack backgroundColor="rgba(142, 142, 147, 0.15)" px="$2" py="$0.5" borderRadius="$2" space="$1" alignItems="center">
                              {editInfo.canEdit ? <Unlock size={10} color="#34C759" /> : <Lock size={10} color="#8E8E93" />}
                              <Text color={editInfo.canEdit ? '#34C759' : '#8E8E93'} fontSize={10} fontWeight="700">
                                {editInfo.label}
                              </Text>
                            </XStack>
                          </XStack>
                          <Text color="$colorPress" fontSize={11} marginTop="$1">Date: {record.date}</Text>
                        </YStack>
                      </XStack>

                      <YStack alignItems="flex-end" space="$1">
                        <Text color="#FF9500" fontSize={20} fontWeight="900">{record.total_count}</Text>
                        <Text color="$colorPress" fontSize={10} fontWeight="700">ATTENDEES</Text>
                      </YStack>
                    </XStack>
                  </Card>
                );
              })
            )}
          </YStack>

        </YStack>
      </ScrollView>

      {/* Live Session Launcher Modal */}
      <Modal visible={showLauncher} transparent animationType="slide">
        <YStack flex={1} backgroundColor="rgba(0,0,0,0.6)" justifyContent="flex-end">
          <Card p="$4" borderTopLeftRadius="$5" borderTopRightRadius="$5" backgroundColor="$background" space="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <Text color="$color" fontSize={16} fontWeight="800">Launch Live Session</Text>
              <TouchableOpacity onPress={() => setShowLauncher(false)}>
                <X size={18} color="$color" />
              </TouchableOpacity>
            </XStack>

            <Text color="$colorPress" fontSize={12}>
              Select service type for today's live individual member check-in session.
            </Text>

            <YStack space="$2">
              {availableServiceTypes.map(st => {
                const isSelected = launchServiceType === st;
                return (
                  <TouchableOpacity key={st} onPress={() => setLaunchServiceType(st)}>
                    <Card p="$3" borderRadius="$3" borderWidth={1.5} borderColor={isSelected ? '#FF9500' : '$borderColor'} backgroundColor={isSelected ? 'rgba(255, 149, 0, 0.1)' : '$background'}>
                      <XStack justifyContent="space-between" alignItems="center">
                        <Text color={isSelected ? '#FF9500' : '$color'} fontSize={14} fontWeight={isSelected ? '800' : '600'}>{st}</Text>
                        {isSelected && <Check size={16} color="#FF9500" />}
                      </XStack>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </YStack>

            <Button backgroundColor="#FF9500" size="$4" onPress={handleStartLiveSession} marginTop="$2">
              <Text color="white" fontWeight="800" fontSize={14}>Start Live Session</Text>
            </Button>
          </Card>
        </YStack>
      </Modal>
    </YStack>
    </SafeAreaView>
  );
}
