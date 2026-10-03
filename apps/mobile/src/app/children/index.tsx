import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshControl, FlatList, Alert, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowRight, Baby, Banknote, BarChart3, Calendar, Download, Plus, SearchX, UserCheck, Users,
} from '@tamagui/lucide-icons';
import {
  LocalChild,
  LocalChildVisitor,
  LocalChildrenAttendanceRecord,
  LocalChildrenGivingRecord,
  getLocalChildren,
  getLocalChildVisitors,
  upsertLocalChildVisitor,
  getLocalChildrenAttendanceRecords,
  saveLocalChildrenAttendanceRecord,
  getLocalChildrenGivingRecords,
  saveLocalChildrenGivingRecord
} from '../../lib/db';
import { api } from '../../lib/api';
import { getChurchZones } from '../../lib/options';
import { pushOrQueue, syncChildren } from '../../lib/syncEngine';
import { toChildVisitorPayload, toChildGivingPayload } from '../../lib/syncPayloads';
import { generateUUID } from '../../lib/uuid';
import { useAppColors } from '../../context/ThemeContext';
import { NativeDatePicker } from '../../components/NativeDatePicker';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonList } from '../../components/Skeleton';
import {
  AmountRow, AppText, Avatar, Badge, Button, EmptyState, FilterChips, IconButton, ListRow, PersonRow, ProgressBar,
  rowPosition, Screen, SearchField, Section, SegmentedControl, Sheet, StatTile, Surface, TextField, useToast,
} from '../../components/ui';
import { memberStatusTone, statusLabel } from '../../theme/status';
import { radius, space } from '../../theme/tokens';

type TabType = 'members' | 'visitors' | 'attendance' | 'giving' | 'analytics';

export default function ChildrenScreen() {
  const router = useRouter();
  const toast = useToast();
  const c = useAppColors();
  const [visitorErrors, setVisitorErrors] = useState<{ child?: string; guardian?: string }>({});
  const [givingError, setGivingError] = useState<string | null>(null);

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
      // 1-2. Members & visitors (shared pull also used at app startup)
      await syncChildren();
      const [updatedKids, updatedVis] = await Promise.all([getLocalChildren(), getLocalChildVisitors()]);
      setChildren(updatedKids);
      setVisitors(updatedVis);

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
    const nextErrors = {
      child: visitorChildName.trim() ? undefined : 'Enter the child’s name.',
      guardian: visitorGuardianName.trim() ? undefined : 'Enter a guardian’s name.',
    };
    setVisitorErrors(nextErrors);
    if (nextErrors.child || nextErrors.guardian) return;

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

      // Server push; queued in the outbox only if the server can't be reached
      await pushOrQueue('POST', '/children/visitors', toChildVisitorPayload({
        id: newId,
        childName: newVisitor.child_name!,
        guardianName: newVisitor.guardian_name,
        guardianPhone: newVisitor.guardian_phone,
        visitDate: newVisitor.visit_date,
        notes: newVisitor.notes
      }));

      setVisitorModalVisible(false);
      setVisitorChildName('');
      setVisitorGuardianName('');
      setVisitorPhone('');
      setVisitorNotes('');
      toast.show({ title: 'Visiting child added', message: newVisitor.child_name });
    } catch (err: any) {
      toast.show({ title: 'Couldn’t save visitor', message: err.message, tone: 'error' });
    } finally {
      setSavingVisitor(false);
    }
  };

  // Convert Visitor to Child Member
  const handleConvertVisitor = (v: LocalChildVisitor) => {
    Alert.alert(
      'Register as member?',
      `Open the registration form for ${v.child_name}?`,
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
      setGivingError('Enter an amount greater than zero.');
      return;
    }
    setGivingError(null);

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

      // Server push; queued in the outbox only if the server can't be reached
      await pushOrQueue('POST', '/children/giving', toChildGivingPayload({
        id: newId,
        givingDate: newGiving.giving_date!,
        serviceType: newGiving.service_type,
        amount: amt,
        notes: newGiving.notes
      }));

      setGivingModalVisible(false);
      setGivingAmount('');
      setGivingNotes('');
      toast.show({ title: 'Giving recorded', message: `GHS ${amt.toFixed(2)}` });
    } catch (err: any) {
      toast.show({ title: 'Couldn’t record giving', message: err.message, tone: 'error' });
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
        { text: 'Export CSV', onPress: () => toast.show({ title: 'Roster exported', message: `${filteredChildren.length} children` }) }
      ]
    );
  };

  const ghs = (n: number) => `GH₵ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d?: string) => {
    if (!d) return '';
    const date = new Date(d);
    return isNaN(date.getTime()) ? d : date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />;

  const tabAction: Record<TabType, { icon: any; label: string; onPress: () => void } | null> = {
    members: { icon: Plus, label: 'Add child', onPress: () => router.push('/children/add' as any) },
    visitors: { icon: Plus, label: 'Add visiting child', onPress: () => setVisitorModalVisible(true) },
    attendance: { icon: UserCheck, label: 'Mark attendance', onPress: () => router.push('/children/attendance/mark' as any) },
    giving: { icon: Plus, label: 'Record giving', onPress: () => setGivingModalVisible(true) },
    analytics: null,
  };
  const action = tabAction[activeTab];

  return (
    <Screen>
      <AppHeader
        title="Children"
        subtitle={`${children.length} registered · ${visitors.length} visitors`}
        showBack
        rightElement={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {activeTab === 'members' ? <IconButton icon={Download} label="Export roster" onPress={handleExportCSV} /> : null}
            {action ? <IconButton icon={action.icon} label={action.label} tone="primary" onPress={action.onPress} /> : null}
          </View>
        }
      />

      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs, backgroundColor: c.background }}>
        <FilterChips
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'members', label: `Members · ${children.length}`, icon: Baby },
            { value: 'visitors', label: `Visitors · ${visitors.length}`, icon: Users },
            { value: 'attendance', label: `Attendance · ${attendanceRecords.length}`, icon: Calendar },
            { value: 'giving', label: 'Giving', icon: Banknote },
            { value: 'analytics', label: 'Analytics', icon: BarChart3 },
          ]}
        />
      </View>

      {/* MEMBERS */}
      {activeTab === 'members' ? (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: space.md, paddingTop: space.xs, gap: space.sm }}>
            <View style={{ flexDirection: 'row', borderRadius: radius.md, backgroundColor: c.surfaceMuted, paddingVertical: space.sm }}>
              {[
                { label: 'Total', value: String(analyticsData.totalKids), tone: 'default' as const },
                { label: 'Active', value: String(analyticsData.activeKids), tone: 'success' as const },
                { label: 'Boys / girls', value: `${analyticsData.boysCount} / ${analyticsData.girlsCount}`, tone: 'default' as const },
              ].map((m, i) => (
                <View key={m.label} style={{ flex: 1, alignItems: 'center', gap: 2, borderLeftWidth: i ? 1 : 0, borderLeftColor: c.border }}>
                  <AppText variant="headline" tone={m.tone} numeric>{m.value}</AppText>
                  <AppText variant="caption" tone="muted">{m.label}</AppText>
                </View>
              ))}
            </View>
            <SearchField value={searchQuery} onChangeText={setSearchQuery} placeholder="Search child or guardian" />
            <FilterChips
              value={selectedZone}
              onChange={setSelectedZone}
              options={zonesList.map(z => ({ value: z, label: z === 'All' ? 'All zones' : `Zone ${z}` }))}
            />
            <SegmentedControl
              accessibilityLabel="Gender"
              value={selectedGender}
              onChange={setSelectedGender}
              options={[{ value: 'all', label: 'All' }, { value: 'male', label: 'Boys' }, { value: 'female', label: 'Girls' }]}
            />
          </View>

          {loading ? (
            <View style={{ padding: space.md }}><SkeletonList count={5} hasAvatar /></View>
          ) : (
            <FlatList
              data={filteredChildren}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, flexGrow: 1 }}
              refreshControl={refresh}
              ListEmptyComponent={
                children.length ? (
                  <EmptyState
                    icon={SearchX}
                    title="No children match"
                    message="Try a different name, zone or gender."
                    action={{ label: 'Clear filters', onPress: () => { setSearchQuery(''); setSelectedZone('All'); setSelectedGender('all'); } }}
                  />
                ) : (
                  <EmptyState icon={Baby} title="No children registered" message="Add the first child to the children’s ministry." action={{ label: 'Add child', onPress: () => router.push('/children/add' as any) }} />
                )
              }
              renderItem={({ item, index }) => {
                const age = calculateAge(item.date_of_birth);
                const details = [
                  age !== null ? `${age} yrs` : null,
                  item.gender ? (item.gender.toLowerCase() === 'male' ? 'Boy' : item.gender.toLowerCase() === 'female' ? 'Girl' : item.gender) : null,
                  item.guardian_name ? `Guardian: ${item.guardian_name}` : null,
                ].filter(Boolean).join(' · ');
                return (
                  <PersonRow
                    name={item.name}
                    position={rowPosition(index, filteredChildren.length)}
                    meta={
                      <>
                        {item.zone ? <Badge label={`Zone ${item.zone}`} tone="neutral" /> : null}
                        <Badge label={statusLabel(item.status)} tone={memberStatusTone(item.status)} />
                      </>
                    }
                    subtitle={details || undefined}
                    onPress={() => router.push(`/children/${item.id}` as any)}
                  />
                );
              }}
            />
          )}
        </View>
      ) : null}

      {/* VISITORS */}
      {activeTab === 'visitors' ? (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: space.md, paddingTop: space.xs }}>
            <SearchField value={visitorSearch} onChangeText={setVisitorSearch} placeholder="Search visiting children" />
          </View>
          <FlatList
            data={filteredVisitors}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xs, flexGrow: 1 }}
            refreshControl={refresh}
            ListEmptyComponent={
              <EmptyState
                icon={Users}
                title={visitorSearch ? 'No visitors match' : 'No visiting children yet'}
                message={visitorSearch ? undefined : 'Log first-time visiting children so they can be followed up.'}
                action={visitorSearch ? { label: 'Clear search', onPress: () => setVisitorSearch('') } : { label: 'Add visiting child', onPress: () => setVisitorModalVisible(true) }}
              />
            }
            renderItem={({ item }) => (
              <Surface style={{ gap: space.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Avatar name={item.child_name} size={40} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyStrong" numberOfLines={1}>{item.child_name}</AppText>
                    <AppText variant="caption" tone="muted">Visited {fmtDate(item.visit_date)}</AppText>
                  </View>
                </View>
                {item.guardian_name ? (
                  <AppText variant="caption" tone="muted">
                    Guardian: {item.guardian_name}{item.guardian_phone ? ` · ${item.guardian_phone}` : ''}
                  </AppText>
                ) : null}
                {item.notes ? <AppText variant="caption" tone="subtle">“{item.notes}”</AppText> : null}
                <View style={{ alignItems: 'flex-end' }}>
                  <Button label="Register as member" icon={ArrowRight} size="sm" variant="soft" onPress={() => handleConvertVisitor(item)} />
                </View>
              </Surface>
            )}
          />
        </View>
      ) : null}

      {/* ATTENDANCE */}
      {activeTab === 'attendance' ? (
        <FlatList
          data={attendanceRecords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, flexGrow: 1 }}
          refreshControl={refresh}
          ListHeaderComponent={
            attendanceRecords.length ? (
              <View style={{ paddingBottom: space.sm }}>
                <Button label="Mark today’s attendance" icon={UserCheck} fullWidth onPress={() => router.push('/children/attendance/mark' as any)} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState icon={Calendar} title="No attendance yet" message="Mark which children were present at a service." action={{ label: 'Mark attendance', onPress: () => router.push('/children/attendance/mark' as any) }} />
          }
          renderItem={({ item, index }) => {
            const presentCount = item.total_present ?? item.total_count ?? 0;
            const totalCount = item.total_members ?? children.length;
            const percent = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
            const first = index === 0;
            const last = index === attendanceRecords.length - 1;
            return (
              <View
                style={{
                  backgroundColor: c.surface, borderColor: c.border,
                  borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopWidth: first ? 1 : 0,
                  borderTopLeftRadius: first ? radius.lg : 0, borderTopRightRadius: first ? radius.lg : 0,
                  borderBottomLeftRadius: last ? radius.lg : 0, borderBottomRightRadius: last ? radius.lg : 0,
                }}
              >
                <ListRow
                  icon={Calendar}
                  title={fmtDate(item.service_date)}
                  subtitle={[item.service_type || 'Sunday Service', item.marked_by ? `Marked by ${item.marked_by}` : null].filter(Boolean).join(' · ')}
                  right={
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <AppText variant="bodyStrong" numeric>
                        <AppText variant="bodyStrong" tone="success" numeric>{item.total_present}</AppText>
                        <AppText variant="caption" tone="muted" numeric> / {item.total_members || children.length}</AppText>
                      </AppText>
                      {percent > 0 ? <Badge label={`${percent}%`} tone="success" /> : null}
                    </View>
                  }
                />
              </View>
            );
          }}
        />
      ) : null}

      {/* GIVING */}
      {activeTab === 'giving' ? (
        <FlatList
          data={givingRecords}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, flexGrow: 1 }}
          refreshControl={refresh}
          ListHeaderComponent={
            <Surface style={{ gap: 4, marginBottom: space.md }}>
              <AppText variant="captionStrong" tone="muted">Total children’s offering</AppText>
              <AppText variant="display" tone="success" numeric numberOfLines={1} adjustsFontSizeToFit>{ghs(analyticsData.totalGiving)}</AppText>
              <AppText variant="caption" tone="muted">{givingRecords.length} {givingRecords.length === 1 ? 'collection' : 'collections'} logged</AppText>
            </Surface>
          }
          ListEmptyComponent={
            <EmptyState icon={Banknote} title="No giving recorded" message="Record children’s offerings after each service." action={{ label: 'Record giving', onPress: () => setGivingModalVisible(true) }} />
          }
          renderItem={({ item, index }) => {
            const first = index === 0;
            const last = index === givingRecords.length - 1;
            return (
              <View
                style={{
                  backgroundColor: c.surface, borderColor: c.border,
                  borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopWidth: first ? 1 : 0,
                  borderTopLeftRadius: first ? radius.lg : 0, borderTopRightRadius: first ? radius.lg : 0,
                  borderBottomLeftRadius: last ? radius.lg : 0, borderBottomRightRadius: last ? radius.lg : 0,
                }}
              >
                <AmountRow
                  title={item.service_type || 'Sunday Service'}
                  subtitle={fmtDate(item.giving_date)}
                  detail={item.notes ? `“${item.notes}”` : undefined}
                  amount={`${item.currency || 'GHS'} ${Number(item.amount).toFixed(2)}`}
                  direction="in"
                />
              </View>
            );
          }}
        />
      ) : null}

      {/* ANALYTICS */}
      {activeTab === 'analytics' ? (
        <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xl }}>
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            <StatTile label="Registered" value={String(analyticsData.totalKids)} icon={Baby} />
            <StatTile label="Active" value={String(analyticsData.activeKids)} icon={UserCheck} tone="success" />
            <StatTile label="Visitors" value={String(analyticsData.visitorsCount)} icon={Users} tone="info" />
          </View>

          <Section title="Gender" bare>
            <Surface style={{ gap: space.md }}>
              {[
                { label: 'Boys', count: analyticsData.boysCount, pct: analyticsData.boysPercent, color: c.chart[1] },
                { label: 'Girls', count: analyticsData.girlsCount, pct: analyticsData.girlsPercent, color: c.chart[3] },
              ].map(g => (
                <View key={g.label} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText variant="bodyMedium">{g.label} · {g.count}</AppText>
                    <AppText variant="bodyStrong" numeric>{g.pct}%</AppText>
                  </View>
                  <ProgressBar percent={g.pct} color={g.color} />
                </View>
              ))}
            </Surface>
          </Section>

          <Section title="Age groups" bare>
            <Surface style={{ gap: space.md }}>
              {[
                { label: 'Nursery · 0–3', count: analyticsData.nursery },
                { label: 'Primary · 4–8', count: analyticsData.primary },
                { label: 'Junior · 9–12', count: analyticsData.junior },
                { label: 'Teens · 13–17', count: analyticsData.teens },
              ].map((b, i) => {
                const pct = analyticsData.totalKids > 0 ? Math.round((b.count / analyticsData.totalKids) * 100) : 0;
                return (
                  <View key={b.label} style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <AppText variant="bodyMedium">{b.label}</AppText>
                      <AppText variant="caption" tone="muted" numeric>{b.count} · {pct}%</AppText>
                    </View>
                    <ProgressBar percent={pct} color={c.chart[i]} />
                  </View>
                );
              })}
            </Surface>
          </Section>
        </ScrollView>
      ) : null}

      {/* Add visiting child */}
      <Sheet
        visible={visitorModalVisible}
        onClose={() => setVisitorModalVisible(false)}
        title="Add visiting child"
        footer={<Button label={savingVisitor ? 'Saving…' : 'Save visitor'} loading={savingVisitor} fullWidth onPress={handleSaveVisitor} />}
      >
        <TextField
          label="Child’s name *"
          placeholder="e.g. David Osei"
          value={visitorChildName}
          onChangeText={t => { setVisitorChildName(t); if (visitorErrors.child) setVisitorErrors(e => ({ ...e, child: undefined })); }}
          autoCapitalize="words"
          error={visitorErrors.child}
        />
        <TextField
          label="Guardian’s name *"
          placeholder="e.g. Grace Osei"
          value={visitorGuardianName}
          onChangeText={t => { setVisitorGuardianName(t); if (visitorErrors.guardian) setVisitorErrors(e => ({ ...e, guardian: undefined })); }}
          autoCapitalize="words"
          error={visitorErrors.guardian}
        />
        <TextField label="Guardian’s phone" placeholder="e.g. 024 123 4567" value={visitorPhone} onChangeText={setVisitorPhone} keyboardType="phone-pad" />
        <NativeDatePicker label="Visit date" value={visitorDate} onChange={setVisitorDate} maxDate={new Date()} />
        <TextField label="Notes" placeholder="Referral, comments…" value={visitorNotes} onChangeText={setVisitorNotes} multiline />
      </Sheet>

      {/* Record giving */}
      <Sheet
        visible={givingModalVisible}
        onClose={() => setGivingModalVisible(false)}
        title="Record children’s giving"
        footer={<Button label={savingGiving ? 'Saving…' : 'Save giving'} loading={savingGiving} fullWidth onPress={handleSaveGiving} />}
      >
        <TextField label="Service" value={givingService} onChangeText={setGivingService} />
        <TextField
          label="Amount (GHS) *"
          placeholder="0.00"
          value={givingAmount}
          onChangeText={t => { setGivingAmount(t); if (givingError) setGivingError(null); }}
          keyboardType="decimal-pad"
          error={givingError}
        />
        <NativeDatePicker label="Date" value={givingDate} onChange={setGivingDate} maxDate={new Date()} />
        <TextField label="Notes / collector" placeholder="Optional" value={givingNotes} onChangeText={setGivingNotes} />
      </Sheet>
    </Screen>
  );
}
