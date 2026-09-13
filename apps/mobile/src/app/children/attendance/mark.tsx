import React, { useEffect, useState, useMemo } from 'react';
import { TouchableOpacity, Alert, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  YStack, 
  XStack, 
  Text, 
  Card, 
  Input, 
  Button, 
  Separator, 
  Spinner, 
  ScrollView 
} from 'tamagui';
import { 
  ArrowLeft, 
  Save, 
  Search, 
  Users, 
  Calendar, 
  Clock, 
  Check, 
  X, 
  UserCheck, 
  Baby 
} from '@tamagui/lucide-icons';
import { 
  LocalChild, 
  getLocalChildren, 
  saveLocalChildrenAttendanceRecord 
} from '../../../lib/db';
import { api } from '../../../lib/api';
import { enqueueSyncTask } from '../../../lib/syncEngine';
import { generateUUID } from '../../../lib/uuid';
import { NativeDatePicker } from '../../../components/NativeDatePicker';
import { AppHeader } from '../../../components/AppHeader';

export default function ChildrenMarkAttendanceScreen() {
  const router = useRouter();

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
      Alert.alert('Validation Error', 'Please mark at least one child as present or absent before saving.');
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

      // 2. Enqueue sync task
      await enqueueSyncTask('child_attendance_create', '/children/attendance', {
        id: newRecordId,
        date: serviceDate,
        serviceType,
        childMemberIds: presentIds,
        absentMemberIds: absentIds,
        visitorsCount: 0
      });

      // 3. Background server push
      try {
        await api.children.attendance.create({
          date: serviceDate,
          serviceType,
          childMemberIds: presentIds,
          visitorsCount: 0
        });
      } catch (e) {
        console.warn('Attendance server API failed, offline queue preserved:', e);
      }

      Alert.alert(
        'Success',
        `Attendance recorded! ${presentIds.length} present, ${absentIds.length} absent out of ${children.length} children.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background">
      <AppHeader
        title="Mark Attendance Roster"
        subtitle="Children Ministry Session Register"
        showBack
        backTitle="Children"
        rightElement={
          <Button 
            size="$3" 
            backgroundColor="#FF9500" 
            borderRadius="$3"
            onPress={handleSave}
            disabled={saving}
            icon={saving ? <Spinner size="small" color="#FFFFFF" /> : <Save size={14} color="#FFFFFF" />}
            pressStyle={{ scale: 0.98 }}
          >
            <Text color="#FFFFFF" fontWeight="700" fontSize={13}>{saving ? 'Saving...' : 'Save'}</Text>
          </Button>
        }
      />

      <YStack flex={1} backgroundColor="$background">
        {/* Service Meta Card */}
        <Card m="$3" p="$3.5" borderRadius="$5" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor" elevate>
          <YStack space="$2">
            <XStack space="$2" alignItems="center">
              <Clock size={16} color="#FF9500" />
              <Text color="$color" fontSize={14} fontWeight="700">Service Details</Text>
            </XStack>
            <XStack space="$2">
              <YStack flex={1}>
                <Text color="$colorPress" fontSize={11} fontWeight="600">Service Type</Text>
                <Input
                  value={serviceType}
                  onChangeText={setServiceType}
                  backgroundColor="$background"
                  borderColor="$borderColor"
                  fontSize={12}
                  height={38}
                />
              </YStack>
              <YStack flex={1}>
                <NativeDatePicker
                  label="Date (YYYY-MM-DD)"
                  value={serviceDate}
                  onChange={setServiceDate}
                  accentColor="#FF9500"
                />
              </YStack>
            </XStack>
          </YStack>
        </Card>

        {/* Counter Summary Pills */}
        <XStack px="$3" space="$2" marginBottom="$2">
          <Card flex={1} p="$2" borderRadius="$4" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor" alignItems="center">
            <Text color="#34C759" fontSize={18} fontWeight="800">{totalPresent}</Text>
            <Text color="$colorPress" fontSize={11}>Present</Text>
          </Card>
          <Card flex={1} p="$2" borderRadius="$4" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor" alignItems="center">
            <Text color="#FF3B30" fontSize={18} fontWeight="800">{totalAbsent}</Text>
            <Text color="$colorPress" fontSize={11}>Absent</Text>
          </Card>
          <Card flex={1} p="$2" borderRadius="$4" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor" alignItems="center">
            <Text color="#8E8E93" fontSize={18} fontWeight="800">{totalUnmarked}</Text>
            <Text color="$colorPress" fontSize={11}>Unmarked</Text>
          </Card>
          <Card flex={1} p="$2" borderRadius="$4" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor" alignItems="center">
            <Text color="$color" fontSize={18} fontWeight="800">{children.length}</Text>
            <Text color="$colorPress" fontSize={11}>Total</Text>
          </Card>
        </XStack>

        {/* Action Controls & Search */}
        <YStack px="$3" space="$2" marginBottom="$2">
          <XStack 
            alignItems="center" 
            backgroundColor="$cardBackground" 
            borderRadius="$4" 
            px="$3" 
            borderWidth={1} 
            borderColor="$borderColor"
          >
            <Search size={15} color="$colorPress" />
            <Input
              flex={1}
              placeholder="Search children roster..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              backgroundColor="transparent"
              borderWidth={0}
              fontSize={13}
              height={38}
            />
          </XStack>

          <XStack justifyContent="space-between" alignItems="center">
            <XStack space="$2">
              <Button
                size="$2.5"
                backgroundColor="rgba(52, 199, 89, 0.12)"
                borderWidth={1}
                borderColor="#34C759"
                onPress={handleMarkAllPresent}
                icon={<UserCheck size={12} color="#34C759" />}
              >
                <Text color="#34C759" fontSize={11} fontWeight="700">All Present</Text>
              </Button>

              <Button
                size="$2.5"
                backgroundColor="rgba(142, 142, 147, 0.12)"
                borderWidth={1}
                borderColor="$borderColor"
                onPress={handleClearAll}
                icon={<X size={12} color="$colorPress" />}
              >
                <Text color="$colorPress" fontSize={11} fontWeight="700">Clear</Text>
              </Button>
            </XStack>

            <TouchableOpacity
              onPress={() => setShowOnlyUnmarked(prev => !prev)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 6,
                backgroundColor: showOnlyUnmarked ? '#FF9500' : 'rgba(142,142,147,0.12)'
              }}
            >
              <Text color={showOnlyUnmarked ? '#FFFFFF' : '$color'} fontSize={11} fontWeight="700">
                {showOnlyUnmarked ? '✓ Unmarked Only' : 'Show All'}
              </Text>
            </TouchableOpacity>
          </XStack>
        </YStack>

        {/* Children Roster List */}
        {loading ? (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <Spinner size="large" color="#FF9500" />
            <Text color="$colorPress" marginTop="$2" fontSize={13}>Loading children roster...</Text>
          </YStack>
        ) : filteredChildren.length > 0 ? (
          <FlatList
            data={filteredChildren}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40 }}
            renderItem={({ item }) => {
              const status = attendanceStatus[item.id] || 'unmarked';
              const age = calculateAge(item.date_of_birth);
              const isBoy = item.gender?.toLowerCase() === 'male';

              return (
                <Card
                  marginBottom="$2"
                  p="$3"
                  borderRadius="$4"
                  backgroundColor="$cardBackground"
                  borderWidth={1}
                  borderColor="$borderColor"
                >
                  <XStack justifyContent="space-between" alignItems="center">
                    <XStack space="$2.5" alignItems="center" flex={1}>
                      <YStack
                        width={36}
                        height={36}
                        borderRadius={18}
                        backgroundColor={isBoy ? 'rgba(0,122,255,0.15)' : 'rgba(255,45,85,0.15)'}
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Baby size={18} color={isBoy ? '#007AFF' : '#FF2D55'} />
                      </YStack>

                      <YStack flex={1}>
                        <Text color="$color" fontSize={14} fontWeight="700" numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text color="$colorPress" fontSize={11}>
                          {age !== null ? `${age} yrs` : 'Age N/A'} • {item.gender ? item.gender.charAt(0).toUpperCase() + item.gender.slice(1) : 'Child'}
                          {item.zone ? ` • Zone ${item.zone}` : ''}
                        </Text>
                      </YStack>
                    </XStack>

                    {/* Present / Absent Toggle Buttons */}
                    <XStack space="$1.5" alignItems="center">
                      <Button
                        size="$2.5"
                        width={38}
                        height={34}
                        backgroundColor={status === 'present' ? '#34C759' : 'rgba(142,142,147,0.12)'}
                        borderWidth={1}
                        borderColor={status === 'present' ? '#34C759' : '$borderColor'}
                        onPress={() => handleToggle(item.id, 'present')}
                      >
                        <Check size={16} color={status === 'present' ? '#FFFFFF' : '#34C759'} />
                      </Button>

                      <Button
                        size="$2.5"
                        width={38}
                        height={34}
                        backgroundColor={status === 'absent' ? '#FF3B30' : 'rgba(142,142,147,0.12)'}
                        borderWidth={1}
                        borderColor={status === 'absent' ? '#FF3B30' : '$borderColor'}
                        onPress={() => handleToggle(item.id, 'absent')}
                      >
                        <X size={16} color={status === 'absent' ? '#FFFFFF' : '#FF3B30'} />
                      </Button>
                    </XStack>
                  </XStack>
                </Card>
              );
            }}
          />
        ) : (
          <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
            <Baby size={40} color="#8E8E93" />
            <Text color="$color" fontSize={15} fontWeight="700" marginTop="$2">No children found</Text>
            <Text color="$colorPress" fontSize={12}>Try adjusting your search or filters.</Text>
          </YStack>
        )}
      </YStack>
    </YStack>
  );
}
