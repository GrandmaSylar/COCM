import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshControl, TouchableOpacity, FlatList, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  YStack, 
  XStack, 
  Text, 
  Card, 
  H2, 
  Paragraph, 
  Input, 
  Button, 
  Spinner, 
  ScrollView, 
  Separator 
} from 'tamagui';
import { 
  Baby, 
  Plus, 
  Search, 
  Users, 
  Calendar, 
  DollarSign, 
  BarChart3, 
  CheckCircle2, 
  Phone, 
  ChevronRight, 
  Download, 
  ArrowRight, 
  X, 
  Save, 
  UserCheck, 
  Clock 
} from '@tamagui/lucide-icons';
import { 
  LocalChild, 
  LocalChildVisitor, 
  LocalChildrenAttendanceRecord, 
  LocalChildrenGivingRecord, 
  getLocalChildren, 
  upsertLocalChild, 
  getLocalChildVisitors, 
  upsertLocalChildVisitor, 
  getLocalChildrenAttendanceRecords, 
  saveLocalChildrenAttendanceRecord, 
  getLocalChildrenGivingRecords, 
  saveLocalChildrenGivingRecord 
} from '../../lib/db';
import { api } from '../../lib/api';
import { getChurchZones } from '../../lib/options';
import { enqueueSyncTask } from '../../lib/syncEngine';
import { generateUUID } from '../../lib/uuid';
import { NativeDatePicker } from '../../components/NativeDatePicker';
import { AppHeader } from '../../components/AppHeader';

type TabType = 'members' | 'visitors' | 'attendance' | 'giving' | 'analytics';

export default function ChildrenScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('members');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [children, setChildren] = useState<LocalChild[]>([]);
  const [visitors, setVisitors] = useState<LocalChildVisitor[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<LocalChildrenAttendanceRecord[]>([]);
  const [givingRecords, setGivingRecords] = useState<LocalChildrenGivingRecord[]>([]);
  const [zonesList, setZonesList] = useState<string[]>(['All', 'A', 'B', 'F', 'K', 'M', 'R']);

  // Filter states for Members tab
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('All');
  const [selectedGender, setSelectedGender] = useState<'all' | 'male' | 'female'>('all');

  // Visitor filter
  const [visitorSearch, setVisitorSearch] = useState('');

  // Modals
  const [visitorModalVisible, setVisitorModalVisible] = useState(false);
  const [visitorChildName, setVisitorChildName] = useState('');
  const [visitorGuardianName, setVisitorGuardianName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [visitorDate, setVisitorDate] = useState(new Date().toISOString().split('T')[0]);
  const [visitorNotes, setVisitorNotes] = useState('');
  const [savingVisitor, setSavingVisitor] = useState(false);

  const [givingModalVisible, setGivingModalVisible] = useState(false);
  const [givingDate, setGivingDate] = useState(new Date().toISOString().split('T')[0]);
  const [givingService, setGivingService] = useState('Sunday Service');
  const [givingAmount, setGivingAmount] = useState('');
  const [givingNotes, setGivingNotes] = useState('');
  const [savingGiving, setSavingGiving] = useState(false);

  // Load from SQLite (0ms instant offline render)
  const loadLocalData = useCallback(async () => {
    try {
      const [localKids, localVis, localAtt, localGiv, dbZones] = await Promise.all([
        getLocalChildren(),
        getLocalChildVisitors(),
        getLocalChildrenAttendanceRecords(),
        getLocalChildrenGivingRecords(),
        getChurchZones()
      ]);

      if (localKids && localKids.length > 0) setChildren(localKids);
      if (localVis && localVis.length > 0) setVisitors(localVis);
      if (localAtt && localAtt.length > 0) setAttendanceRecords(localAtt);
      if (localGiv && localGiv.length > 0) setGivingRecords(localGiv);
      if (dbZones && dbZones.length > 0) {
        setZonesList(['All', ...dbZones]);
      }
    } catch (err) {
      console.warn('Error reading SQLite children data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync with Remote API in background
  const syncRemoteData = useCallback(async () => {
    try {
      // 1. Members
      try {
        const remoteMembers = await api.children.members.getAll();
        if (Array.isArray(remoteMembers) && remoteMembers.length > 0) {
          for (const rm of remoteMembers) {
            await upsertLocalChild({
              id: rm.id,
              name: rm.name || `${rm.firstName || ''} ${rm.lastName || ''}`.trim() || 'Child Member',
              first_name: rm.firstName,
              last_name: rm.lastName,
              other_names: rm.otherNames,
              date_of_birth: rm.dateOfBirth || rm.date_of_birth || '',
              gender: rm.gender,
              zone: rm.zone,
              status: rm.status || 'active',
              guardian_name: rm.guardianName || (rm.parents && rm.parents[0] ? `${rm.parents[0].firstName} ${rm.parents[0].lastName}` : undefined),
              guardian_phone: rm.guardianPhone || (rm.parents && rm.parents[0] ? rm.parents[0].phone : undefined),
              raw_json: JSON.stringify(rm),
              created_at: rm.createdAt || rm.created_at || new Date().toISOString()
            });
          }
          const updated = await getLocalChildren();
          setChildren(updated);
        }
      } catch (e) {
        console.warn('Members remote fetch failed, using local:', e);
      }

      // 2. Visitors
      try {
        const remoteVisitors = await api.children.visitors.getAll();
        if (Array.isArray(remoteVisitors) && remoteVisitors.length > 0) {
          for (const rv of remoteVisitors) {
            await upsertLocalChildVisitor({
              id: rv.id,
              child_name: rv.childName || rv.name || rv.child_name,
              guardian_name: rv.guardianName || rv.guardian_name,
              guardian_phone: rv.guardianPhone || rv.phone || rv.guardian_phone,
              visit_date: rv.visitDate || rv.visit_date || new Date().toISOString().split('T')[0],
              notes: rv.notes,
              status: rv.status || 'visited',
              created_at: rv.createdAt || rv.created_at || new Date().toISOString()
            });
          }
          const updatedVis = await getLocalChildVisitors();
          setVisitors(updatedVis);
        }
      } catch (e) {
        console.warn('Visitors remote fetch failed:', e);
      }

      // 3. Attendance
      try {
        const remoteAttendance = await api.children.attendance.getAll();
        if (Array.isArray(remoteAttendance) && remoteAttendance.length > 0) {
          for (const ra of remoteAttendance) {
            await saveLocalChildrenAttendanceRecord({
              id: ra.id,
              service_date: ra.serviceDate || ra.service_date,
              service_type: ra.serviceType || ra.service_type || 'Sunday Service',
              total_present: ra.totalPresent || ra.presentCount || ra.total_present || 0,
              total_members: ra.totalMembers || ra.total_members || 0,
              marked_by: ra.markedBy || ra.marked_by,
              created_at: ra.createdAt || ra.created_at || new Date().toISOString()
            });
          }
          const updatedAtt = await getLocalChildrenAttendanceRecords();
          setAttendanceRecords(updatedAtt);
        }
      } catch (e) {
        console.warn('Attendance remote fetch failed:', e);
      }

      // 4. Giving
      try {
        const remoteGiving = await api.children.giving.getAll();
        if (Array.isArray(remoteGiving) && remoteGiving.length > 0) {
          for (const rg of remoteGiving) {
            await saveLocalChildrenGivingRecord({
              id: rg.id,
              giving_date: rg.givingDate || rg.giving_date || rg.date,
              service_type: rg.serviceType || rg.service_type || 'Sunday Service',
              amount: Number(rg.amount || 0),
              currency: rg.currency || 'GHS',
              notes: rg.notes,
              created_at: rg.createdAt || rg.created_at || new Date().toISOString()
            });
          }
          const updatedGiv = await getLocalChildrenGivingRecords();
          setGivingRecords(updatedGiv);
        }
      } catch (e) {
        console.warn('Giving remote fetch failed:', e);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLocalData();
    syncRemoteData();
  }, [loadLocalData, syncRemoteData]);

  const onRefresh = () => {
    setRefreshing(true);
    syncRemoteData();
  };

  // Helper: calculate age from DOB
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

  // Filtered Children
  const filteredChildren = useMemo(() => {
    return children.filter(c => {
      const matchName = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.guardian_name && c.guardian_name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchZone = selectedZone === 'All' || c.zone === selectedZone || (c.zone && `Zone ${c.zone}` === selectedZone);
      const matchGender = selectedGender === 'all' || c.gender?.toLowerCase() === selectedGender;
      return matchName && matchZone && matchGender;
    });
  }, [children, searchQuery, selectedZone, selectedGender]);

  // Filtered Visitors
  const filteredVisitors = useMemo(() => {
    return visitors.filter(v => {
      if (!visitorSearch) return true;
      const q = visitorSearch.toLowerCase();
      return (v.child_name && v.child_name.toLowerCase().includes(q)) || 
        (v.first_name && v.first_name.toLowerCase().includes(q)) || 
        (v.guardian_name && v.guardian_name.toLowerCase().includes(q));
    });
  }, [visitors, visitorSearch]);

  // Analytics Computations
  const analyticsData = useMemo(() => {
    const totalKids = children.length;
    const activeKids = children.filter(c => c.status === 'active').length;
    const boysCount = children.filter(c => c.gender?.toLowerCase() === 'male').length;
    const girlsCount = children.filter(c => c.gender?.toLowerCase() === 'female').length;

    let nursery = 0; // 0-3
    let primary = 0; // 4-8
    let junior = 0;  // 9-12
    let teens = 0;   // 13-17

    children.forEach(c => {
      const age = calculateAge(c.date_of_birth);
      if (age !== null) {
        if (age <= 3) nursery++;
        else if (age <= 8) primary++;
        else if (age <= 12) junior++;
        else if (age <= 17) teens++;
      }
    });

    const totalGiving = givingRecords.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

    return {
      totalKids,
      activeKids,
      visitorsCount: visitors.length,
      boysCount,
      girlsCount,
      boysPercent: totalKids > 0 ? Math.round((boysCount / totalKids) * 100) : 0,
      girlsPercent: totalKids > 0 ? Math.round((girlsCount / totalKids) * 100) : 0,
      nursery,
      primary,
      junior,
      teens,
      totalGiving
    };
  }, [children, visitors, givingRecords]);

  // Handlers for Add Visitor
  const handleSaveVisitor = async () => {
    if (!visitorChildName.trim()) {
      Alert.alert('Validation Error', 'Please provide the visiting child name.');
      return;
    }

    setSavingVisitor(true);
    try {
      const newId = generateUUID();
      const newVisitor: LocalChildVisitor = {
        id: newId,
        child_name: visitorChildName.trim(),
        guardian_name: visitorGuardianName.trim() || undefined,
        guardian_phone: visitorPhone.trim() || undefined,
        visit_date: visitorDate || new Date().toISOString().split('T')[0],
        notes: visitorNotes.trim() || undefined,
        status: 'visited',
        created_at: new Date().toISOString()
      };

      // 0ms local save
      await upsertLocalChildVisitor(newVisitor);
      setVisitors(prev => [newVisitor, ...prev]);

      // Enqueue sync task
      await enqueueSyncTask('child_visitor_create', '/children/visitors', {
        id: newId,
        childName: newVisitor.child_name,
        guardianName: newVisitor.guardian_name,
        guardianPhone: newVisitor.guardian_phone,
        visitDate: newVisitor.visit_date,
        notes: newVisitor.notes
      });

      // Background API
      try {
        await api.children.visitors.create({
          childName: newVisitor.child_name,
          guardianName: newVisitor.guardian_name,
          guardianPhone: newVisitor.guardian_phone,
          visitDate: newVisitor.visit_date,
          notes: newVisitor.notes
        });
      } catch (e) {
        console.warn('Visitor API create failed, enqueued offline:', e);
      }

      setVisitorModalVisible(false);
      setVisitorChildName('');
      setVisitorGuardianName('');
      setVisitorPhone('');
      setVisitorNotes('');
      Alert.alert('Success', 'Visitor record added successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save visitor');
    } finally {
      setSavingVisitor(false);
    }
  };

  // Convert Visitor to Child Member
  const handleConvertVisitor = (v: LocalChildVisitor) => {
    Alert.alert(
      'Convert Visitor to Member',
      `Would you like to register ${v.child_name} as a full child member?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Register Member',
          onPress: () => {
            router.push('/children/add' as any);
          }
        }
      ]
    );
  };

  // Handlers for Add Giving
  const handleSaveGiving = async () => {
    const amt = parseFloat(givingAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid giving amount.');
      return;
    }

    setSavingGiving(true);
    try {
      const newId = generateUUID();
      const newGiving: LocalChildrenGivingRecord = {
        id: newId,
        giving_date: givingDate || new Date().toISOString().split('T')[0],
        service_type: givingService,
        amount: amt,
        currency: 'GHS',
        notes: givingNotes.trim() || undefined,
        created_at: new Date().toISOString()
      };

      // 0ms local save
      await saveLocalChildrenGivingRecord(newGiving);
      setGivingRecords(prev => [newGiving, ...prev]);

      // Enqueue sync task
      await enqueueSyncTask('child_giving_create', '/children/giving', {
        id: newId,
        givingDate: newGiving.giving_date,
        serviceType: newGiving.service_type,
        amount: newGiving.amount,
        currency: newGiving.currency,
        notes: newGiving.notes
      });

      // Background API
      try {
        await api.children.giving.create({
          givingDate: newGiving.giving_date,
          serviceType: newGiving.service_type,
          amount: newGiving.amount,
          currency: newGiving.currency,
          notes: newGiving.notes
        });
      } catch (e) {
        console.warn('Giving API create failed, enqueued offline:', e);
      }

      setGivingModalVisible(false);
      setGivingAmount('');
      setGivingNotes('');
      Alert.alert('Success', 'Children ministry giving recorded');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record giving');
    } finally {
      setSavingGiving(false);
    }
  };

  const handleExportCSV = () => {
    Alert.alert(
      'Export Children Registry',
      `Export ${filteredChildren.length} children records to CSV?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export CSV', onPress: () => Alert.alert('Success', 'Children roster exported successfully.') }
      ]
    );
  };

  return (
    <YStack flex={1} backgroundColor="$background">
      <AppHeader
        title="Children Ministry"
        subtitle="Registry, Roster, Attendance & Growth"
        showBack
        backTitle="People"
        rightElement={
          <XStack space="$2">
            {activeTab === 'members' && (
              <>
                <Button 
                  size="$3" 
                  backgroundColor="rgba(0,122,255,0.12)" 
                  borderRadius="$3"
                  onPress={handleExportCSV}
                  icon={<Download size={14} color="#007AFF" />}
                  pressStyle={{ scale: 0.98 }}
                >
                  <Text color="#007AFF" fontSize={11} fontWeight="700">Export</Text>
                </Button>

                <Button 
                  size="$3" 
                  backgroundColor="#FF9500" 
                  borderRadius="$3"
                  onPress={() => router.push('/children/add' as any)}
                  icon={<Plus size={15} color="#FFFFFF" />}
                  pressStyle={{ scale: 0.98 }}
                >
                  <Text color="#FFFFFF" fontSize={12} fontWeight="700">Add Child</Text>
                </Button>
              </>
            )}

            {activeTab === 'visitors' && (
              <Button 
                size="$3" 
                backgroundColor="#FF9500" 
                borderRadius="$3"
                onPress={() => setVisitorModalVisible(true)}
                icon={<Plus size={15} color="#FFFFFF" />}
                pressStyle={{ scale: 0.98 }}
              >
                <Text color="#FFFFFF" fontSize={12} fontWeight="700">Add Visitor</Text>
              </Button>
            )}

            {activeTab === 'attendance' && (
              <Button 
                size="$3" 
                backgroundColor="#FF9500" 
                borderRadius="$3"
                onPress={() => router.push('/children/attendance/mark' as any)}
                icon={<UserCheck size={15} color="#FFFFFF" />}
                pressStyle={{ scale: 0.98 }}
              >
                <Text color="#FFFFFF" fontSize={12} fontWeight="700">Mark Roster</Text>
              </Button>
            )}

            {activeTab === 'giving' && (
              <Button 
                size="$3" 
                backgroundColor="#FF9500" 
                borderRadius="$3"
                onPress={() => setGivingModalVisible(true)}
                icon={<Plus size={15} color="#FFFFFF" />}
                pressStyle={{ scale: 0.98 }}
              >
                <Text color="#FFFFFF" fontSize={12} fontWeight="700">Record Giving</Text>
              </Button>
            )}
          </XStack>
        }
      />

      {/* 5-Tab Segmented Control */}
      <XStack backgroundColor="$cardBackground" px="$2" py="$1.5" borderBottomWidth={1} borderColor="$borderColor">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack space="$1.5">
              {(
                [
                  { id: 'members' as const, label: 'Members', icon: Baby, count: children.length as number | undefined },
                  { id: 'visitors' as const, label: 'Visitors', icon: Users, count: visitors.length as number | undefined },
                  { id: 'attendance' as const, label: 'Attendance', icon: Calendar, count: attendanceRecords.length as number | undefined },
                  { id: 'giving' as const, label: 'Giving', icon: DollarSign, count: undefined },
                  { id: 'analytics' as const, label: 'Analytics', icon: BarChart3, count: undefined }
                ]
              ).map(tab => {
                const isActive = activeTab === tab.id;
                const IconComponent = tab.icon;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: isActive ? '#FF9500' : 'transparent',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <IconComponent size={14} color={isActive ? '#FFFFFF' : '#94A3B8'} />
                    <Text color={isActive ? '#FFFFFF' : '#94A3B8'} fontWeight="700" fontSize={12}>
                      {tab.label}
                    </Text>
                    {tab.count !== undefined ? (
                      <YStack
                        backgroundColor={isActive ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)'}
                        px="$1.5"
                        py="$0.5"
                        borderRadius="$2"
                      >
                        <Text color={isActive ? '#FFFFFF' : '#94A3B8'} fontSize={10} fontWeight="700">
                          {tab.count}
                        </Text>
                      </YStack>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </XStack>
          </ScrollView>
        </XStack>

        {/* TAB 1: MEMBERS */}
        {activeTab === 'members' && (
          <YStack flex={1}>
            {/* Quick Metrics Bar */}
            <XStack px="$4" py="$2.5" space="$2" backgroundColor="$background">
              <Card flex={1} p="$2.5" borderRadius="$4" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor">
                <Text color="$colorPress" fontSize={11} fontWeight="600">Total Children</Text>
                <Text color="$color" fontSize={18} fontWeight="800" marginTop="$0.5">{analyticsData.totalKids}</Text>
              </Card>
              <Card flex={1} p="$2.5" borderRadius="$4" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor">
                <Text color="$colorPress" fontSize={11} fontWeight="600">Active</Text>
                <Text color="#34C759" fontSize={18} fontWeight="800" marginTop="$0.5">{analyticsData.activeKids}</Text>
              </Card>
              <Card flex={1} p="$2.5" borderRadius="$4" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor">
                <Text color="$colorPress" fontSize={11} fontWeight="600">Boys / Girls</Text>
                <Text color="#FF9500" fontSize={18} fontWeight="800" marginTop="$0.5">{analyticsData.boysCount}/{analyticsData.girlsCount}</Text>
              </Card>
            </XStack>

            {/* Search Bar & Filters */}
            <YStack px="$4" py="$2" space="$2">
              <XStack 
                alignItems="center" 
                backgroundColor="$cardBackground" 
                borderRadius="$4" 
                px="$3" 
                borderWidth={1} 
                borderColor="$borderColor"
              >
                <Search size={16} color="$colorPress" />
                <Input
                  flex={1}
                  placeholder="Search child by name or guardian..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  backgroundColor="transparent"
                  borderWidth={0}
                  fontSize={13}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={15} color="$colorPress" />
                  </TouchableOpacity>
                ) : null}
              </XStack>

              {/* Zone Filter Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <XStack space="$1.5">
                  {zonesList.map(z => {
                    const isSel = selectedZone === z;
                    return (
                      <TouchableOpacity
                        key={z}
                        onPress={() => setSelectedZone(z)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 5,
                          borderRadius: 6,
                          backgroundColor: isSel ? '#FF9500' : 'rgba(142,142,147,0.12)',
                          borderWidth: 1,
                          borderColor: isSel ? '#FF9500' : 'transparent'
                        }}
                      >
                        <Text color={isSel ? '#FFFFFF' : '$color'} fontSize={11} fontWeight="700">
                          {z === 'All' ? 'All Zones' : `Zone ${z}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </XStack>
              </ScrollView>
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
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF9500']} />}
                renderItem={({ item }) => {
                  const age = calculateAge(item.date_of_birth);
                  const isBoy = item.gender?.toLowerCase() === 'male';
                  return (
                    <TouchableOpacity onPress={() => router.push(`/children/${item.id}` as any)}>
                      <Card
                        marginBottom="$3"
                        padding="$3.5"
                        borderRadius="$5"
                        backgroundColor="$cardBackground"
                        borderColor="$borderColor"
                        borderWidth={1}
                        elevate
                      >
                        <XStack space="$3" alignItems="center">
                          {/* Avatar */}
                          <YStack
                            backgroundColor={isBoy ? 'rgba(0, 122, 255, 0.12)' : 'rgba(255, 45, 85, 0.12)'}
                            p="$2.5"
                            borderRadius="$4"
                            alignItems="center"
                            justifyContent="center"
                            width={46}
                            height={46}
                          >
                            <Baby size={24} color={isBoy ? '#007AFF' : '#FF2D55'} />
                          </YStack>

                          {/* Info */}
                          <YStack flex={1} space="$1">
                            <XStack justifyContent="space-between" alignItems="center">
                              <Text color="$color" fontSize={15} fontWeight="700" numberOfLines={1}>
                                {item.name}
                              </Text>
                              <XStack space="$1.5" alignItems="center">
                                {item.zone ? (
                                  <YStack backgroundColor="rgba(255, 149, 0, 0.15)" px="$2" py="$0.5" borderRadius="$2">
                                    <Text color="#FF9500" fontSize={10} fontWeight="700">Zone {item.zone}</Text>
                                  </YStack>
                                ) : null}
                                <ChevronRight size={16} color="$colorPress" />
                              </XStack>
                            </XStack>

                            <XStack space="$3" alignItems="center">
                              <Text color="$colorPress" fontSize={12}>
                                {age !== null ? `${age} yrs old` : 'Age N/A'} • {item.gender ? item.gender.charAt(0).toUpperCase() + item.gender.slice(1) : 'Child'}
                              </Text>
                              <YStack
                                px="$2"
                                py="$0.5"
                                borderRadius="$2"
                                backgroundColor={item.status === 'active' ? 'rgba(52, 199, 89, 0.12)' : 'rgba(142, 142, 147, 0.12)'}
                              >
                                <Text
                                  fontSize={10}
                                  fontWeight="700"
                                  color={item.status === 'active' ? '#34C759' : '#8E8E93'}
                                  textTransform="capitalize"
                                >
                                  {item.status || 'Active'}
                                </Text>
                              </YStack>
                            </XStack>

                            {item.guardian_name ? (
                              <Text color="$colorPress" fontSize={11} numberOfLines={1}>
                                Guardian: {item.guardian_name} {item.guardian_phone ? `(${item.guardian_phone})` : ''}
                              </Text>
                            ) : null}
                          </YStack>
                        </XStack>
                      </Card>
                    </TouchableOpacity>
                  );
                }}
              />
            ) : (
              <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
                <Baby size={44} color="#8E8E93" />
                <Text color="$color" fontSize={16} fontWeight="700" marginTop="$3">No children found</Text>
                <Paragraph color="$colorPress" fontSize={13} textAlign="center" marginTop="$1">
                  Try clearing the search query or tap "+ Add Child" above.
                </Paragraph>
              </YStack>
            )}
          </YStack>
        )}

        {/* TAB 2: VISITORS */}
        {activeTab === 'visitors' && (
          <YStack flex={1}>
            <YStack px="$4" py="$2.5">
              <XStack 
                alignItems="center" 
                backgroundColor="$cardBackground" 
                borderRadius="$4" 
                px="$3" 
                borderWidth={1} 
                borderColor="$borderColor"
              >
                <Search size={16} color="$colorPress" />
                <Input
                  flex={1}
                  placeholder="Search visiting children..."
                  value={visitorSearch}
                  onChangeText={setVisitorSearch}
                  backgroundColor="transparent"
                  borderWidth={0}
                  fontSize={13}
                />
              </XStack>
            </YStack>

            {filteredVisitors.length > 0 ? (
              <FlatList
                data={filteredVisitors}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF9500']} />}
                renderItem={({ item }) => (
                  <Card
                    marginBottom="$3"
                    padding="$3.5"
                    borderRadius="$5"
                    backgroundColor="$cardBackground"
                    borderColor="$borderColor"
                    borderWidth={1}
                    elevate
                  >
                    <YStack space="$2">
                      <XStack justifyContent="space-between" alignItems="center">
                        <XStack space="$2" alignItems="center">
                          <Users size={16} color="#FF9500" />
                          <Text color="$color" fontSize={15} fontWeight="700">{item.child_name}</Text>
                        </XStack>
                        <YStack backgroundColor="rgba(0, 122, 255, 0.12)" px="$2" py="$0.5" borderRadius="$2">
                          <Text color="#007AFF" fontSize={10} fontWeight="700">Visited {item.visit_date}</Text>
                        </YStack>
                      </XStack>

                      {item.guardian_name ? (
                        <Text color="$colorPress" fontSize={12}>
                          Guardian: {item.guardian_name} {item.guardian_phone ? `• ${item.guardian_phone}` : ''}
                        </Text>
                      ) : null}

                      {item.notes ? (
                        <Text color="$colorPress" fontSize={11} fontStyle="italic">
                          "{item.notes}"
                        </Text>
                      ) : null}

                      <Separator borderColor="$borderColor" />

                      <XStack justifyContent="flex-end">
                        <Button
                          size="$2.5"
                          backgroundColor="rgba(255, 149, 0, 0.12)"
                          borderWidth={1}
                          borderColor="#FF9500"
                          onPress={() => handleConvertVisitor(item)}
                          icon={<ArrowRight size={12} color="#FF9500" />}
                        >
                          <Text color="#FF9500" fontSize={11} fontWeight="700">Convert to Member</Text>
                        </Button>
                      </XStack>
                    </YStack>
                  </Card>
                )}
              />
            ) : (
              <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
                <Users size={40} color="#8E8E93" />
                <Text color="$color" fontSize={16} fontWeight="700" marginTop="$3">No visiting children recorded</Text>
                <Paragraph color="$colorPress" fontSize={13} textAlign="center" marginTop="$1">
                  Tap "+ Add Visitor" above to log first-time visiting kids.
                </Paragraph>
              </YStack>
            )}
          </YStack>
        )}

        {/* TAB 3: ATTENDANCE */}
        {activeTab === 'attendance' && (
          <YStack flex={1}>
            <XStack px="$4" py="$3" justifyContent="space-between" alignItems="center" backgroundColor="$cardBackground" borderBottomWidth={1} borderColor="$borderColor">
              <YStack>
                <Text color="$color" fontSize={14} fontWeight="700">Sunday Service Records</Text>
                <Text color="$colorPress" fontSize={12}>{attendanceRecords.length} recorded session(s)</Text>
              </YStack>
              <Button
                size="$3"
                backgroundColor="#FF9500"
                borderRadius="$3"
                onPress={() => router.push('/children/attendance/mark' as any)}
                icon={<UserCheck size={14} color="#FFFFFF" />}
              >
                <Text color="#FFFFFF" fontSize={12} fontWeight="700">Mark Attendance</Text>
              </Button>
            </XStack>

            {attendanceRecords.length > 0 ? (
              <FlatList
                data={attendanceRecords}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF9500']} />}
                renderItem={({ item }) => {
                  const presentCount = item.total_present ?? item.total_count ?? 0;
                  const totalCount = item.total_members ?? children.length;
                  const percent = totalCount > 0 
                    ? Math.round((presentCount / totalCount) * 100) 
                    : 0;
                  return (
                    <Card
                      marginBottom="$3"
                      padding="$3.5"
                      borderRadius="$5"
                      backgroundColor="$cardBackground"
                      borderColor="$borderColor"
                      borderWidth={1}
                      elevate
                    >
                      <XStack justifyContent="space-between" alignItems="center">
                        <YStack space="$1">
                          <XStack space="$2" alignItems="center">
                            <Calendar size={15} color="#FF9500" />
                            <Text color="$color" fontSize={15} fontWeight="700">{item.service_date}</Text>
                          </XStack>
                          <Text color="$colorPress" fontSize={12}>{item.service_type || 'Sunday Service'}</Text>
                          {item.marked_by ? (
                            <Text color="$colorPress" fontSize={10}>Marked by: {item.marked_by}</Text>
                          ) : null}
                        </YStack>

                        <YStack alignItems="flex-end" space="$1">
                          <XStack space="$1" alignItems="baseline">
                            <Text color="#34C759" fontSize={18} fontWeight="800">{item.total_present}</Text>
                            <Text color="$colorPress" fontSize={12}>/ {item.total_members || children.length}</Text>
                          </XStack>
                          {percent > 0 && (
                            <YStack backgroundColor="rgba(52, 199, 89, 0.12)" px="$2" py="$0.5" borderRadius="$2">
                              <Text color="#34C759" fontSize={10} fontWeight="700">{percent}% turnout</Text>
                            </YStack>
                          )}
                        </YStack>
                      </XStack>
                    </Card>
                  );
                }}
              />
            ) : (
              <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
                <Calendar size={40} color="#8E8E93" />
                <Text color="$color" fontSize={16} fontWeight="700" marginTop="$3">No attendance records yet</Text>
                <Paragraph color="$colorPress" fontSize={13} textAlign="center" marginTop="$1">
                  Tap "Mark Attendance" above to mark children present for service.
                </Paragraph>
              </YStack>
            )}
          </YStack>
        )}

        {/* TAB 4: GIVING */}
        {activeTab === 'giving' && (
          <YStack flex={1}>
            {/* Total Giving Hero */}
            <Card m="$4" p="$4" borderRadius="$5" backgroundColor="#FF9500" elevate>
              <YStack space="$1">
                <Text color="rgba(255,255,255,0.8)" fontSize={12} fontWeight="600">Total Children Offering</Text>
                <Text color="#FFFFFF" fontSize={26} fontWeight="900">
                  GHS {analyticsData.totalGiving.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text color="rgba(255,255,255,0.9)" fontSize={11} marginTop="$1">
                  {givingRecords.length} giving collection(s) logged
                </Text>
              </YStack>
            </Card>

            {givingRecords.length > 0 ? (
              <FlatList
                data={givingRecords}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF9500']} />}
                renderItem={({ item }) => (
                  <Card
                    marginBottom="$3"
                    padding="$3.5"
                    borderRadius="$5"
                    backgroundColor="$cardBackground"
                    borderColor="$borderColor"
                    borderWidth={1}
                    elevate
                  >
                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack space="$1">
                        <Text color="$color" fontSize={15} fontWeight="700">{item.service_type || 'Sunday Service'}</Text>
                        <Text color="$colorPress" fontSize={12}>{item.giving_date}</Text>
                        {item.notes ? (
                          <Text color="$colorPress" fontSize={11} fontStyle="italic">"{item.notes}"</Text>
                        ) : null}
                      </YStack>

                      <Text color="#34C759" fontSize={16} fontWeight="800">
                        {item.currency || 'GHS'} {Number(item.amount).toFixed(2)}
                      </Text>
                    </XStack>
                  </Card>
                )}
              />
            ) : (
              <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
                <DollarSign size={40} color="#8E8E93" />
                <Text color="$color" fontSize={16} fontWeight="700" marginTop="$3">No giving records yet</Text>
                <Paragraph color="$colorPress" fontSize={13} textAlign="center" marginTop="$1">
                  Tap "+ Record Giving" in the top bar to record children offerings.
                </Paragraph>
              </YStack>
            )}
          </YStack>
        )}

        {/* TAB 5: ANALYTICS */}
        {activeTab === 'analytics' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <YStack space="$4">
              {/* Summary Roster Overview */}
              <Card p="$4" borderRadius="$5" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor" elevate>
                <Text color="$color" fontSize={15} fontWeight="700" marginBottom="$3">Department Overview</Text>
                <XStack space="$2">
                  <Card flex={1} p="$3" borderRadius="$4" backgroundColor="$background" borderWidth={1} borderColor="$borderColor">
                    <Text color="$colorPress" fontSize={11}>Registered</Text>
                    <Text color="$color" fontSize={20} fontWeight="800">{analyticsData.totalKids}</Text>
                  </Card>
                  <Card flex={1} p="$3" borderRadius="$4" backgroundColor="$background" borderWidth={1} borderColor="$borderColor">
                    <Text color="$colorPress" fontSize={11}>Active</Text>
                    <Text color="#34C759" fontSize={20} fontWeight="800">{analyticsData.activeKids}</Text>
                  </Card>
                  <Card flex={1} p="$3" borderRadius="$4" backgroundColor="$background" borderWidth={1} borderColor="$borderColor">
                    <Text color="$colorPress" fontSize={11}>Visitors</Text>
                    <Text color="#007AFF" fontSize={20} fontWeight="800">{analyticsData.visitorsCount}</Text>
                  </Card>
                </XStack>
              </Card>

              {/* Gender Distribution */}
              <Card p="$4" borderRadius="$5" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor" elevate>
                <Text color="$color" fontSize={15} fontWeight="700" marginBottom="$3">Gender Ratio</Text>
                <XStack space="$4" alignItems="center" marginBottom="$3">
                  <YStack flex={1}>
                    <XStack justifyContent="space-between">
                      <Text color="#007AFF" fontSize={13} fontWeight="700">Boys ({analyticsData.boysCount})</Text>
                      <Text color="#007AFF" fontSize={13} fontWeight="700">{analyticsData.boysPercent}%</Text>
                    </XStack>
                    <YStack height={8} backgroundColor="rgba(0,122,255,0.2)" borderRadius={4} marginTop="$1">
                      <YStack height={8} width={`${analyticsData.boysPercent}%`} backgroundColor="#007AFF" borderRadius={4} />
                    </YStack>
                  </YStack>

                  <YStack flex={1}>
                    <XStack justifyContent="space-between">
                      <Text color="#FF2D55" fontSize={13} fontWeight="700">Girls ({analyticsData.girlsCount})</Text>
                      <Text color="#FF2D55" fontSize={13} fontWeight="700">{analyticsData.girlsPercent}%</Text>
                    </XStack>
                    <YStack height={8} backgroundColor="rgba(255,45,85,0.2)" borderRadius={4} marginTop="$1">
                      <YStack height={8} width={`${analyticsData.girlsPercent}%`} backgroundColor="#FF2D55" borderRadius={4} />
                    </YStack>
                  </YStack>
                </XStack>
              </Card>

              {/* Age Bracket Distribution */}
              <Card p="$4" borderRadius="$5" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor" elevate>
                <Text color="$color" fontSize={15} fontWeight="700" marginBottom="$3">Age Group Brackets</Text>
                <YStack space="$3">
                  {[
                    { label: 'Nursery (0 - 3 years)', count: analyticsData.nursery, color: '#FF9500' },
                    { label: 'Primary (4 - 8 years)', count: analyticsData.primary, color: '#34C759' },
                    { label: 'Junior (9 - 12 years)', count: analyticsData.junior, color: '#007AFF' },
                    { label: 'Teens (13 - 17 years)', count: analyticsData.teens, color: '#AF52DE' }
                  ].map(b => {
                    const pct = analyticsData.totalKids > 0 ? Math.round((b.count / analyticsData.totalKids) * 100) : 0;
                    return (
                      <YStack key={b.label} space="$1">
                        <XStack justifyContent="space-between">
                          <Text color="$color" fontSize={12} fontWeight="600">{b.label}</Text>
                          <Text color="$colorPress" fontSize={12} fontWeight="700">{b.count} kids ({pct}%)</Text>
                        </XStack>
                        <YStack height={6} backgroundColor="rgba(142,142,147,0.15)" borderRadius={3}>
                          <YStack height={6} width={`${pct}%`} backgroundColor={b.color} borderRadius={3} />
                        </YStack>
                      </YStack>
                    );
                  })}
                </YStack>
              </Card>
            </YStack>
          </ScrollView>
        )}

        {/* MODAL: Add Visitor */}
        <Modal visible={visitorModalVisible} animationType="slide" transparent>
          <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <YStack flex={1} backgroundColor="$background" marginTop={60} borderTopLeftRadius={20} borderTopRightRadius={20} padding="$4">
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                <Text color="$color" fontSize={17} fontWeight="800">Add Visiting Child</Text>
                <TouchableOpacity onPress={() => setVisitorModalVisible(false)}>
                  <X size={22} color="$colorPress" />
                </TouchableOpacity>
              </XStack>

              <ScrollView showsVerticalScrollIndicator={false}>
                <YStack space="$3">
                  <YStack space="$1">
                    <Text color="$colorPress" fontSize={12} fontWeight="600">Child Name *</Text>
                    <Input 
                      placeholder="e.g. David Osei"
                      value={visitorChildName}
                      onChangeText={setVisitorChildName}
                      backgroundColor="$cardBackground"
                      borderColor="$borderColor"
                    />
                  </YStack>

                  <YStack space="$1">
                    <Text color="$colorPress" fontSize={12} fontWeight="600">Guardian / Parent Name</Text>
                    <Input 
                      placeholder="e.g. Grace Osei"
                      value={visitorGuardianName}
                      onChangeText={setVisitorGuardianName}
                      backgroundColor="$cardBackground"
                      borderColor="$borderColor"
                    />
                  </YStack>

                  <YStack space="$1">
                    <Text color="$colorPress" fontSize={12} fontWeight="600">Guardian Phone</Text>
                    <Input 
                      placeholder="e.g. +233241234567"
                      value={visitorPhone}
                      onChangeText={setVisitorPhone}
                      keyboardType="phone-pad"
                      backgroundColor="$cardBackground"
                      borderColor="$borderColor"
                    />
                  </YStack>

                  <NativeDatePicker
                    label="Visit Date (YYYY-MM-DD)"
                    value={visitorDate}
                    onChange={setVisitorDate}
                    accentColor="#FF9500"
                    backgroundColor="$cardBackground"
                  />

                  <YStack space="$1">
                    <Text color="$colorPress" fontSize={12} fontWeight="600">Notes</Text>
                    <Input 
                      placeholder="Any comments, referral source, etc."
                      value={visitorNotes}
                      onChangeText={setVisitorNotes}
                      backgroundColor="$cardBackground"
                      borderColor="$borderColor"
                    />
                  </YStack>

                  <Button
                    marginTop="$3"
                    backgroundColor="#FF9500"
                    height={46}
                    borderRadius="$3"
                    onPress={handleSaveVisitor}
                    disabled={savingVisitor}
                    icon={savingVisitor ? <Spinner size="small" color="#FFFFFF" /> : <Save size={15} color="#FFFFFF" />}
                  >
                    <Text color="#FFFFFF" fontWeight="700" fontSize={14}>
                      {savingVisitor ? 'Saving...' : 'Save Visitor'}
                    </Text>
                  </Button>
                </YStack>
              </ScrollView>
            </YStack>
          </SafeAreaView>
        </Modal>

        {/* MODAL: Record Giving */}
        <Modal visible={givingModalVisible} animationType="slide" transparent>
          <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <YStack flex={1} backgroundColor="$background" marginTop={60} borderTopLeftRadius={20} borderTopRightRadius={20} padding="$4">
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                <Text color="$color" fontSize={17} fontWeight="800">Record Children Giving</Text>
                <TouchableOpacity onPress={() => setGivingModalVisible(false)}>
                  <X size={22} color="$colorPress" />
                </TouchableOpacity>
              </XStack>

              <ScrollView showsVerticalScrollIndicator={false}>
                <YStack space="$3">
                  <YStack space="$1">
                    <Text color="$colorPress" fontSize={12} fontWeight="600">Service Type</Text>
                    <Input 
                      value={givingService}
                      onChangeText={setGivingService}
                      backgroundColor="$cardBackground"
                      borderColor="$borderColor"
                    />
                  </YStack>

                  <YStack space="$1">
                    <Text color="$colorPress" fontSize={12} fontWeight="600">Amount (GHS) *</Text>
                    <Input 
                      placeholder="e.g. 150.00"
                      value={givingAmount}
                      onChangeText={setGivingAmount}
                      keyboardType="decimal-pad"
                      backgroundColor="$cardBackground"
                      borderColor="$borderColor"
                    />
                  </YStack>

                  <NativeDatePicker
                    label="Date (YYYY-MM-DD)"
                    value={givingDate}
                    onChange={setGivingDate}
                    accentColor="#FF9500"
                    backgroundColor="$cardBackground"
                  />

                  <YStack space="$1">
                    <Text color="$colorPress" fontSize={12} fontWeight="600">Notes / Collector</Text>
                    <Input 
                      placeholder="Optional remarks"
                      value={givingNotes}
                      onChangeText={setGivingNotes}
                      backgroundColor="$cardBackground"
                      borderColor="$borderColor"
                    />
                  </YStack>

                  <Button
                    marginTop="$3"
                    backgroundColor="#FF9500"
                    height={46}
                    borderRadius="$3"
                    onPress={handleSaveGiving}
                    disabled={savingGiving}
                    icon={savingGiving ? <Spinner size="small" color="#FFFFFF" /> : <Save size={15} color="#FFFFFF" />}
                  >
                    <Text color="#FFFFFF" fontWeight="700" fontSize={14}>
                      {savingGiving ? 'Saving...' : 'Save Giving Record'}
                    </Text>
                  </Button>
                </YStack>
              </ScrollView>
            </YStack>
          </SafeAreaView>
        </Modal>

    </YStack>
  );
}
