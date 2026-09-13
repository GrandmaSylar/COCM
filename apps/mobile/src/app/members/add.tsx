import React, { useState, useEffect, useMemo } from 'react';
import { TouchableOpacity, Alert, Modal, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  YStack, 
  XStack, 
  Text, 
  Card, 
  H2, 
  Input, 
  Button, 
  Separator, 
  Spinner, 
  TextArea,
  ScrollView
} from 'tamagui';
import { 
  ArrowLeft, 
  Save, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Church, 
  ShieldCheck, 
  Users, 
  CreditCard, 
  FileText, 
  Plus, 
  Trash2, 
  Check, 
  Search, 
  CheckCircle, 
  X 
} from '@tamagui/lucide-icons';
import { getLocalDb, LocalMember, upsertLocalMember, upsertLocalFamilyMember } from '../../lib/db';
import { NativeDatePicker } from '../../components/NativeDatePicker';
import { supabase } from '../../lib/supabase';
import { getDropdownOptions, getChurchZones, syncDropdownOptions, syncChurchZones } from '../../lib/options';
import { generateUUID } from '../../lib/uuid';
import { api } from '../../lib/api';
import { enqueueSyncTask } from '../../lib/syncEngine';
import { AppHeader } from '../../components/AppHeader';

const GENDERS = ['male', 'female'];
const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'];
const MEMBER_STATUSES = ['active', 'semi-active', 'new', 'sick', 'traveled', 'schooling', 'inactive', 'not baptised', 'blacklisted'];

interface FamilyMemberItem {
  id: string;
  relationship: 'mother' | 'father' | 'spouse' | 'child' | 'sibling';
  firstName: string;
  lastName: string;
  otherNames?: string;
  phone?: string;
  isLinked: boolean;
  linkedMemberId?: string | null;
}

export default function AddMemberScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Dynamic Options from SQLite/Server
  const [ministriesList, setMinistriesList] = useState<string[]>([]);
  const [positionsList, setPositionsList] = useState<string[]>([]);
  const [zonesList, setZonesList] = useState<string[]>(['A', 'B', 'F', 'K', 'M', 'R']);

  // Church Member Directory for Family Linking
  const [memberRoster, setMemberRoster] = useState<LocalMember[]>([]);
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [activeFamilyIndex, setActiveFamilyIndex] = useState<number | null>(null);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [otherNames, setOtherNames] = useState('');
  const [gender, setGender] = useState('male');
  const [maritalStatus, setMaritalStatus] = useState('single');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [occupation, setOccupation] = useState('');
  const [hometown, setHometown] = useState('');
  
  const [phone, setPhone] = useState('');
  const [secondPhone, setSecondPhone] = useState('');
  const [email, setEmail] = useState('');
  
  const [residenceLocation, setResidenceLocation] = useState('');
  const [digitalAddress, setDigitalAddress] = useState('');
  const [zone, setZone] = useState('A');
  const [zoneNumber, setZoneNumber] = useState('');

  const [baptismStatus, setBaptismStatus] = useState<'baptised' | 'not_baptised'>('not_baptised');
  const [baptismDateType, setBaptismDateType] = useState<'full' | 'monthYear' | 'yearOnly' | 'forgotten'>('full');
  const [baptismFullDate, setBaptismFullDate] = useState('');
  const [baptismMonth, setBaptismMonth] = useState('');
  const [baptismYear, setBaptismYear] = useState('');
  const [previousCongregation, setPreviousCongregation] = useState('');
  const [roleInPreviousCongregation, setRoleInPreviousCongregation] = useState('');

  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

  const [ghanaCardNumber, setGhanaCardNumber] = useState('');
  const [ghanaCardExpiryDate, setGhanaCardExpiryDate] = useState('');
  const [alternativeIdType, setAlternativeIdType] = useState('');
  const [alternativeIdNumber, setAlternativeIdNumber] = useState('');

  const [familyMembers, setFamilyMembers] = useState<FamilyMemberItem[]>([]);
  const [status, setStatus] = useState('new');
  const [notes, setNotes] = useState('');

  // Initial Load: Options & Member Roster
  useEffect(() => {
    const loadData = async () => {
      try {
        const [ministries, positions, zones] = await Promise.all([
          getDropdownOptions('ministries'),
          getDropdownOptions('position_held'),
          getChurchZones()
        ]);
        if (ministries.length > 0) setMinistriesList(ministries);
        if (positions.length > 0) setPositionsList(positions);
        if (zones.length > 0) {
          setZonesList(zones);
          setZone(zones[0]);
        }

        // Load adult member directory for family linking
        const db = await getLocalDb();
        const roster = await db.getAllAsync<LocalMember>('SELECT * FROM members ORDER BY name ASC');
        if (roster) setMemberRoster(roster);
      } catch (err) {
        console.warn('Error loading initial dropdown options & roster:', err);
      }
    };

    loadData();
    syncDropdownOptions();
    syncChurchZones();
  }, []);

  // Compute next sequential zone number automatically
  useEffect(() => {
    async function computeNextZoneNumber() {
      try {
        const db = await getLocalDb();
        const rows = await db.getAllAsync<{ zone_number: string }>(
          `SELECT zone_number FROM members WHERE zone = ? AND zone_number IS NOT NULL AND zone_number != ''`,
          [zone]
        ).catch(() => []);
        let maxNum = 0;
        const prefix = zone.toUpperCase();
        for (const r of rows) {
          const zn = (r.zone_number || '').trim().toUpperCase();
          if (zn.startsWith(prefix)) {
            const numPart = parseInt(zn.slice(prefix.length), 10);
            if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
          }
        }
        const nextNum = maxNum + 1;
        setZoneNumber(`${prefix}${String(nextNum).padStart(2, '0')}`);
      } catch (err) {
        console.warn('Error auto-generating zone number:', err);
        const prefix = zone ? zone.toUpperCase() : 'A';
        setZoneNumber(`${prefix}01`);
      }
    }
    computeNextZoneNumber();
  }, [zone]);

  // Overall Completion Progress calculation
  const progress = useMemo(() => {
    let filled = 0;
    const total = 8;
    if (firstName && lastName) filled++;
    if (phone) filled++;
    if (residenceLocation && zone) filled++;
    if (baptismStatus) filled++;
    if (selectedMinistries.length > 0 || selectedPositions.length > 0) filled++;
    if (familyMembers.length > 0) filled++;
    if (ghanaCardNumber || alternativeIdNumber) filled++;
    if (status) filled++;
    return Math.round((filled / total) * 100);
  }, [
    firstName, lastName, phone, residenceLocation, zone, baptismStatus,
    selectedMinistries, selectedPositions, familyMembers, ghanaCardNumber,
    alternativeIdNumber, status
  ]);

  const toggleMinistry = (m: string) => {
    setSelectedMinistries(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const togglePosition = (p: string) => {
    setSelectedPositions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleAddFamilyMember = () => {
    setFamilyMembers(prev => [
      ...prev,
      {
        id: generateUUID(),
        relationship: 'child',
        firstName: '',
        lastName: '',
        phone: '',
        isLinked: false,
        linkedMemberId: null
      }
    ]);
  };

  const handleRemoveFamilyMember = (index: number) => {
    setFamilyMembers(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateFamilyMember = (index: number, field: string, value: any) => {
    setFamilyMembers(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const openMemberPicker = (idx: number) => {
    setActiveFamilyIndex(idx);
    setSearchMemberQuery('');
    setMemberPickerVisible(true);
  };

  const selectMemberAsRelative = (member: LocalMember) => {
    if (activeFamilyIndex === null) return;
    const nameParts = member.name.split(' ');
    const fName = nameParts[0] || '';
    const lName = nameParts.slice(1).join(' ') || '';

    setFamilyMembers(prev => prev.map((fm, i) => {
      if (i === activeFamilyIndex) {
        return {
          ...fm,
          firstName: fName,
          lastName: lName,
          phone: member.phone || fm.phone,
          isLinked: true,
          linkedMemberId: member.id
        };
      }
      return fm;
    }));

    setMemberPickerVisible(false);
    setActiveFamilyIndex(null);
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Validation Error', 'First Name and Last Name are required.');
      return;
    }

    if (!phone.trim()) {
      Alert.alert('Validation Error', 'Primary Phone number is required.');
      return;
    }

    setSubmitting(true);
    try {
      const newId = generateUUID();
      const createdAt = new Date().toISOString();
      const fullName = `${firstName.trim()} ${otherNames ? `${otherNames.trim()} ` : ''}${lastName.trim()}`.trim();

      const memberPayload = {
        id: newId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        otherNames: otherNames.trim() || undefined,
        gender,
        maritalStatus,
        dateOfBirth: dateOfBirth || '1990-01-01',
        joinDate: createdAt,
        occupation: occupation.trim() || undefined,
        hometown: hometown.trim() || undefined,
        phone: phone.trim(),
        secondPhone: secondPhone.trim() || undefined,
        email: email.trim() || undefined,
        residenceLocation: residenceLocation.trim(),
        digitalAddress: digitalAddress.trim() || undefined,
        zone,
        zoneNumber,
        status: baptismStatus === 'not_baptised' ? 'not baptised' : status,
        notes: notes.trim() || undefined,
        baptismInfo: {
          baptismStatus,
          dateType: baptismDateType,
          fullDate: baptismFullDate,
          month: baptismMonth,
          year: baptismYear,
          previousCongregation,
          roleInPreviousCongregation
        },
        ministries: selectedMinistries,
        positionHeld: selectedPositions,
        legalInfo: {
          ghanaCardNumber,
          ghanaCardExpiryDate,
          alternativeIdType,
          alternativeIdNumber
        },
        familyMembers
      };

      // 1. Instant SQLite Local Write (0ms Latency)
      await upsertLocalMember({
        id: newId,
        name: fullName,
        phone,
        email,
        role: selectedPositions[0] || 'Member',
        zone,
        zone_number: zoneNumber,
        ministry: selectedMinistries[0],
        status: memberPayload.status,
        raw_json: JSON.stringify(memberPayload),
        created_at: createdAt
      });

      // Save family members to local SQLite
      for (const fm of familyMembers) {
        if (fm.firstName.trim() || fm.lastName.trim()) {
          await upsertLocalFamilyMember({
            id: fm.id || generateUUID(),
            member_id: newId,
            relationship: fm.relationship || 'sibling',
            first_name: fm.firstName.trim(),
            last_name: fm.lastName.trim(),
            other_names: fm.otherNames || undefined,
            phone: fm.phone || undefined,
            is_linked: fm.isLinked ? 1 : 0,
            linked_member_id: fm.linkedMemberId || undefined,
            created_at: createdAt
          });
        }
      }

      // 2. Queue Outbox Task for guaranteed offline resilience
      await enqueueSyncTask('member_create', '/members', memberPayload);

      // 3. Background server push via Edge Function (handles family_members & bidirectional inverse links)
      try {
        await api.members.create(memberPayload);
      } catch (apiErr) {
        console.warn('Server push failed, mutation queued offline:', apiErr);
      }

      Alert.alert('Success', 'New church member registered successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);

    } catch (err) {
      console.error('Failed saving new member:', err);
      Alert.alert('Error', 'Failed to save member details. Please verify your entries.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMembers = memberRoster.filter(m => 
    !searchMemberQuery || m.name.toLowerCase().includes(searchMemberQuery.toLowerCase())
  );

  return (
    <YStack flex={1} backgroundColor="$background">
      <AppHeader
        title="Add New Member"
        subtitle="Register Congregation Member"
        showBack
        backTitle="Members"
        rightElement={
          <Button 
            size="$3" 
            backgroundColor="#007AFF" 
            borderRadius="$3"
            onPress={handleSave}
            disabled={submitting}
            icon={submitting ? <Spinner size="small" color="#FFFFFF" /> : <Save size={14} color="#FFFFFF" />}
            pressStyle={{ scale: 0.98 }}
          >
            <Text color="#FFFFFF" fontWeight="700" fontSize={13}>{submitting ? 'Saving...' : 'Save'}</Text>
          </Button>
        }
      />

      <ScrollView style={{ flex: 1 }} backgroundColor="$background" contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
        <YStack space="$4">

          {/* Registration Progress Indicator */}
          <Card padding="$3.5" borderRadius="$4" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1}>
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
              <Text color="$color" fontSize={13} fontWeight="700">Registration Progress</Text>
              <Text color="#007AFF" fontSize={13} fontWeight="800">{progress}%</Text>
            </XStack>
            <YStack height={6} backgroundColor="rgba(142,142,147,0.15)" borderRadius={3}>
              <YStack height={6} width={`${progress}%`} backgroundColor="#007AFF" borderRadius={3} />
            </YStack>
          </Card>

          {/* Section 1: Basic Information */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <User size={18} color="#007AFF" />
                <Text color="$color" fontSize={16} fontWeight="700">Basic Information</Text>
              </XStack>
              <Separator borderColor="$borderColor" />

              <YStack space="$2">
                <Text color="$colorPress" fontSize={12} fontWeight="600">First Name *</Text>
                <Input value={firstName} onChangeText={setFirstName} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="e.g. Samuel" />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Last Name *</Text>
                <Input value={lastName} onChangeText={setLastName} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="e.g. Mensah" />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Other Names</Text>
                <Input value={otherNames} onChangeText={setOtherNames} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="e.g. Kwabena" />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Gender *</Text>
                <XStack space="$2">
                  {GENDERS.map(g => (
                    <TouchableOpacity key={g} onPress={() => setGender(g)} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: gender === g ? '#007AFF' : 'rgba(142,142,147,0.12)', alignItems: 'center' }}>
                      <Text color={gender === g ? '#FFFFFF' : '$color'} fontSize={13} fontWeight="700" textTransform="capitalize">{g}</Text>
                    </TouchableOpacity>
                  ))}
                </XStack>

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Marital Status</Text>
                <XStack space="$1.5" flexWrap="wrap">
                  {MARITAL_STATUSES.map(m => (
                    <TouchableOpacity key={m} onPress={() => setMaritalStatus(m)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: maritalStatus === m ? '#007AFF' : 'rgba(142,142,147,0.12)', marginBottom: 4 }}>
                      <Text color={maritalStatus === m ? '#FFFFFF' : '$color'} fontSize={12} fontWeight="700" textTransform="capitalize">{m}</Text>
                    </TouchableOpacity>
                  ))}
                </XStack>

                <NativeDatePicker
                  label="Date of Birth (YYYY-MM-DD)"
                  required
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  placeholder="YYYY-MM-DD (e.g. 1994-08-15)"
                  maxDate={new Date()}
                  accentColor="#007AFF"
                />

                <Text color="$colorPress" fontSize={12} fontWeight="600">Occupation</Text>
                <Input value={occupation} onChangeText={setOccupation} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="e.g. Civil Engineer" />

                <Text color="$colorPress" fontSize={12} fontWeight="600">Hometown</Text>
                <Input value={hometown} onChangeText={setHometown} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="e.g. Mampong" />
              </YStack>
            </YStack>
          </Card>

          {/* Section 2: Contact Information */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <Phone size={18} color="#34C759" />
                <Text color="$color" fontSize={16} fontWeight="700">Contact Details</Text>
              </XStack>
              <Separator borderColor="$borderColor" />

              <YStack space="$2">
                <Text color="$colorPress" fontSize={12} fontWeight="600">Primary Phone *</Text>
                <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="e.g. 0244123456" />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Secondary Phone</Text>
                <Input value={secondPhone} onChangeText={setSecondPhone} keyboardType="phone-pad" backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="Optional alternative phone" />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Email Address</Text>
                <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="e.g. member@example.com" />
              </YStack>
            </YStack>
          </Card>

          {/* Section 3: Location & Church Zone */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <MapPin size={18} color="#FF9500" />
                <Text color="$color" fontSize={16} fontWeight="700">Location & Zone</Text>
              </XStack>
              <Separator borderColor="$borderColor" />

              <YStack space="$2">
                <Text color="$colorPress" fontSize={12} fontWeight="600">Residential Area / Location *</Text>
                <Input value={residenceLocation} onChangeText={setResidenceLocation} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="e.g. Bubiashie, Accra" />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Digital Address</Text>
                <Input value={digitalAddress} onChangeText={setDigitalAddress} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="e.g. GA-183-9201" />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Church Zone *</Text>
                <XStack space="$2" flexWrap="wrap">
                  {zonesList.map(z => (
                    <TouchableOpacity key={z} onPress={() => setZone(z)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: zone === z ? '#FF9500' : 'rgba(142,142,147,0.12)', marginBottom: 6 }}>
                      <Text color={zone === z ? '#FFFFFF' : '$color'} fontSize={12} fontWeight="700">Zone {z}</Text>
                    </TouchableOpacity>
                  ))}
                </XStack>

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Assigned Zone Number</Text>
                <Input value={zoneNumber} onChangeText={setZoneNumber} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="e.g. A01" />
              </YStack>
            </YStack>
          </Card>

          {/* Section 4: Baptism Information */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <Church size={18} color="#5856D6" />
                <Text color="$color" fontSize={16} fontWeight="700">Baptism Information</Text>
              </XStack>
              <Separator borderColor="$borderColor" />

              <YStack space="$2">
                <Text color="$colorPress" fontSize={12} fontWeight="600">Baptism Status</Text>
                <XStack space="$2">
                  <TouchableOpacity onPress={() => setBaptismStatus('baptised')} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: baptismStatus === 'baptised' ? '#34C759' : 'rgba(142,142,147,0.12)', alignItems: 'center' }}>
                    <Text color={baptismStatus === 'baptised' ? '#FFFFFF' : '$color'} fontSize={13} fontWeight="700">Baptised</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setBaptismStatus('not_baptised')} style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: baptismStatus === 'not_baptised' ? '#FF3B30' : 'rgba(142,142,147,0.12)', alignItems: 'center' }}>
                    <Text color={baptismStatus === 'not_baptised' ? '#FFFFFF' : '$color'} fontSize={13} fontWeight="700">Not Baptised</Text>
                  </TouchableOpacity>
                </XStack>

                {baptismStatus === 'baptised' && (
                  <YStack space="$2" marginTop="$2">
                    <Text color="$colorPress" fontSize={12} fontWeight="600">Date Record Type</Text>
                    <XStack space="$1.5" flexWrap="wrap">
                      {['full', 'monthYear', 'yearOnly', 'forgotten'].map(dt => (
                        <TouchableOpacity key={dt} onPress={() => setBaptismDateType(dt as any)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: baptismDateType === dt ? '#5856D6' : 'rgba(142,142,147,0.12)', marginBottom: 4 }}>
                          <Text color={baptismDateType === dt ? '#FFFFFF' : '$color'} fontSize={12} fontWeight="700" textTransform="capitalize">{dt}</Text>
                        </TouchableOpacity>
                      ))}
                    </XStack>

                    {baptismDateType === 'full' && (
                      <NativeDatePicker
                        value={baptismFullDate}
                        onChange={setBaptismFullDate}
                        placeholder="Full Date (YYYY-MM-DD)"
                        maxDate={new Date()}
                        accentColor="#5856D6"
                      />
                    )}

                    {baptismDateType === 'monthYear' && (
                      <XStack space="$2">
                        <Input flex={1} value={baptismMonth} onChangeText={setBaptismMonth} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="Month (1-12)" />
                        <Input flex={1} value={baptismYear} onChangeText={setBaptismYear} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="Year (YYYY)" />
                      </XStack>
                    )}

                    {baptismDateType === 'yearOnly' && (
                      <Input value={baptismYear} onChangeText={setBaptismYear} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="Year (YYYY)" />
                    )}

                    <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Previous Congregation</Text>
                    <Input value={previousCongregation} onChangeText={setPreviousCongregation} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="e.g. Assemblies of God" />

                    <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Role in Previous Congregation</Text>
                    <Input value={roleInPreviousCongregation} onChangeText={setRoleInPreviousCongregation} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} placeholder="e.g. Deacon / Youth Leader" />
                  </YStack>
                )}
              </YStack>
            </YStack>
          </Card>

          {/* Section 5: Ministries & Positions */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <ShieldCheck size={18} color="#AF52DE" />
                <Text color="$color" fontSize={16} fontWeight="700">Ministries & Positions</Text>
              </XStack>
              <Separator borderColor="$borderColor" />

              <YStack space="$2">
                <Text color="$colorPress" fontSize={12} fontWeight="600">Ministries</Text>
                <XStack space="$1.5" flexWrap="wrap">
                  {ministriesList.map(m => {
                    const sel = selectedMinistries.includes(m);
                    return (
                      <TouchableOpacity key={m} onPress={() => toggleMinistry(m)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: sel ? '#007AFF' : 'rgba(142,142,147,0.12)', marginBottom: 6 }}>
                        <XStack space="$1" alignItems="center">
                          {sel ? <Check size={12} color="#FFFFFF" /> : null}
                          <Text color={sel ? '#FFFFFF' : '$color'} fontSize={12} fontWeight="700">{m}</Text>
                        </XStack>
                      </TouchableOpacity>
                    );
                  })}
                </XStack>

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$3">Positions Held</Text>
                <XStack space="$1.5" flexWrap="wrap">
                  {positionsList.map(p => {
                    const sel = selectedPositions.includes(p);
                    return (
                      <TouchableOpacity key={p} onPress={() => togglePosition(p)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: sel ? '#AF52DE' : 'rgba(142,142,147,0.12)', marginBottom: 6 }}>
                        <XStack space="$1" alignItems="center">
                          {sel ? <Check size={12} color="#FFFFFF" /> : null}
                          <Text color={sel ? '#FFFFFF' : '$color'} fontSize={12} fontWeight="700">{p}</Text>
                        </XStack>
                      </TouchableOpacity>
                    );
                  })}
                </XStack>
              </YStack>
            </YStack>
          </Card>

          {/* Section 6: Family Members & Relatives */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <XStack space="$2" alignItems="center">
                  <Users size={18} color="#007AFF" />
                  <Text color="$color" fontSize={16} fontWeight="700">Family Members ({familyMembers.length})</Text>
                </XStack>
                <Button size="$2.5" backgroundColor="#007AFF" borderRadius="$3" onPress={handleAddFamilyMember} icon={<Plus size={12} color="#FFFFFF" />}>
                  <Text color="#FFFFFF" fontSize={11} fontWeight="700">Add Relative</Text>
                </Button>
              </XStack>
              <Separator borderColor="$borderColor" />

              {familyMembers.length === 0 ? (
                <Text color="$colorPress" fontSize={12} textAlign="center" py="$2">No family members added yet. Tap "+ Add Relative" above.</Text>
              ) : (
                <YStack space="$3">
                  {familyMembers.map((fm, idx) => (
                    <YStack key={fm.id || idx} p="$3" borderRadius="$3" backgroundColor="$background" borderColor="$borderColor" borderWidth={1} space="$2.5">
                      <XStack justifyContent="space-between" alignItems="center">
                        <Text color="#007AFF" fontSize={13} fontWeight="800">Relative #{idx + 1}</Text>
                        <TouchableOpacity onPress={() => handleRemoveFamilyMember(idx)}>
                          <Trash2 size={16} color="#FF3B30" />
                        </TouchableOpacity>
                      </XStack>

                      {/* Select from Church Directory Button */}
                      <Button 
                        size="$3" 
                        backgroundColor="rgba(0, 122, 255, 0.1)" 
                        borderWidth={1} 
                        borderColor="#007AFF"
                        onPress={() => openMemberPicker(idx)}
                        icon={<Search size={14} color="#007AFF" />}
                      >
                        <Text color="#007AFF" fontWeight="700" fontSize={12}>
                          {fm.isLinked ? '✓ Linked Church Member' : 'Select from Church Directory'}
                        </Text>
                      </Button>

                      {/* Relationship Choice */}
                      <XStack space="$1.5" flexWrap="wrap">
                        {(['father', 'mother', 'spouse', 'child', 'sibling'] as const).map(rel => (
                          <TouchableOpacity 
                            key={rel} 
                            onPress={() => handleUpdateFamilyMember(idx, 'relationship', rel)} 
                            style={{ 
                              paddingHorizontal: 9, 
                              paddingVertical: 5, 
                              borderRadius: 6, 
                              backgroundColor: fm.relationship === rel ? '#007AFF' : 'rgba(142,142,147,0.12)' 
                            }}
                          >
                            <Text color={fm.relationship === rel ? '#FFFFFF' : '$color'} fontSize={11} fontWeight="700" textTransform="capitalize">
                              {rel}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </XStack>

                      <XStack space="$2">
                        <Input flex={1} value={fm.firstName} onChangeText={t => handleUpdateFamilyMember(idx, 'firstName', t)} placeholder="First Name" backgroundColor="$cardBackground" borderColor="$borderColor" borderRadius="$3" height={36} fontSize={12} />
                        <Input flex={1} value={fm.lastName} onChangeText={t => handleUpdateFamilyMember(idx, 'lastName', t)} placeholder="Last Name" backgroundColor="$cardBackground" borderColor="$borderColor" borderRadius="$3" height={36} fontSize={12} />
                      </XStack>

                      <Input value={fm.phone || ''} onChangeText={t => handleUpdateFamilyMember(idx, 'phone', t)} placeholder="Phone Number" keyboardType="phone-pad" backgroundColor="$cardBackground" borderColor="$borderColor" borderRadius="$3" height={36} fontSize={12} />
                    </YStack>
                  ))}
                </YStack>
              )}
            </YStack>
          </Card>

          {/* Section 7: Status & Notes */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <FileText size={18} color="#FF2D55" />
                <Text color="$color" fontSize={16} fontWeight="700">Status & Notes</Text>
              </XStack>
              <Separator borderColor="$borderColor" />

              <YStack space="$2">
                <Text color="$colorPress" fontSize={12} fontWeight="600">Initial Status</Text>
                <XStack space="$1.5" flexWrap="wrap">
                  {MEMBER_STATUSES.map(st => (
                    <TouchableOpacity key={st} onPress={() => setStatus(st)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: status === st ? '#007AFF' : 'rgba(142,142,147,0.12)', marginBottom: 6 }}>
                      <Text color={status === st ? '#FFFFFF' : '$color'} fontSize={12} fontWeight="700" textTransform="capitalize">{st}</Text>
                    </TouchableOpacity>
                  ))}
                </XStack>

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Notes</Text>
                <TextArea value={notes} onChangeText={setNotes} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" minHeight={80} placeholder="Add administrative notes..." />
              </YStack>
            </YStack>
          </Card>

          {/* Submit Action Button */}
          <Button
            height={50}
            backgroundColor="#007AFF"
            borderRadius="$4"
            onPress={handleSave}
            disabled={submitting}
            icon={submitting ? <Spinner color="#FFFFFF" /> : <Save size={18} color="#FFFFFF" />}
          >
            <Text color="#FFFFFF" fontWeight="800" fontSize={16}>
              {submitting ? 'Registering Member...' : 'Save & Register Member'}
            </Text>
          </Button>

        </YStack>
      </ScrollView>

      {/* Adult Member Selection Modal for Family Linking */}
      <Modal visible={memberPickerVisible} animationType="slide" transparent>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <YStack flex={1} backgroundColor="$background" marginTop={60} borderTopLeftRadius={20} borderTopRightRadius={20} padding="$4">
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
              <Text color="$color" fontSize={17} fontWeight="800">Select Church Member</Text>
              <TouchableOpacity onPress={() => setMemberPickerVisible(false)}>
                <X size={22} color="$colorPress" />
              </TouchableOpacity>
            </XStack>

            <Input 
              value={searchMemberQuery} 
              onChangeText={setSearchMemberQuery} 
              placeholder="Search by member name..." 
              backgroundColor="$cardBackground" 
              borderColor="$borderColor" 
              marginBottom="$3" 
            />

            <FlatList 
              data={filteredMembers} 
              keyExtractor={(m) => m.id} 
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => selectMemberAsRelative(item)}>
                  <XStack p="$3" borderRadius="$3" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor" marginBottom="$2" justifyContent="space-between" alignItems="center">
                    <YStack>
                      <Text color="$color" fontSize={14} fontWeight="700">{item.name}</Text>
                      <Text color="$colorPress" fontSize={12}>{item.phone || item.email || (item.zone ? `Zone ${item.zone}` : 'Member')}</Text>
                    </YStack>
                    <Check size={18} color="#007AFF" />
                  </XStack>
                </TouchableOpacity>
              )} 
            />
          </YStack>
        </SafeAreaView>
      </Modal>
    </YStack>
  );
}
