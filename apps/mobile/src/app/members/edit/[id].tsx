import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Alert, Image, Modal, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  X 
} from '@tamagui/lucide-icons';
import { getLocalDb, LocalMember, upsertLocalMember, upsertLocalFamilyMember, getLocalFamilyMembers } from '../../../lib/db';
import { NativeDatePicker } from '../../../components/NativeDatePicker';
import { getOrCacheProfilePhoto } from '../../../lib/photoCache';
import { supabase } from '../../../lib/supabase';
import { getDropdownOptions, getChurchZones } from '../../../lib/options';
import { enqueueSyncTask } from '../../../lib/syncEngine';
import { generateUUID } from '../../../lib/uuid';
import { api } from '../../../lib/api';
import { resolveMemberFamily } from '../../../lib/family';
import { AppHeader } from '../../../components/AppHeader';

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

export default function EditMemberScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Dynamic Options
  const [zonesList, setZonesList] = useState<string[]>(['A', 'B', 'F', 'K', 'M', 'R']);
  const [ministriesList, setMinistriesList] = useState<string[]>([]);
  const [positionsList, setPositionsList] = useState<string[]>([]);

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
  const [dateOfBirth, setDateOfBirth] = useState('1990-01-01');
  const [occupation, setOccupation] = useState('');
  const [hometown, setHometown] = useState('');
  
  const [phone, setPhone] = useState('');
  const [secondPhone, setSecondPhone] = useState('');
  const [email, setEmail] = useState('');
  
  const [residenceLocation, setResidenceLocation] = useState('');
  const [digitalAddress, setDigitalAddress] = useState('');
  const [zone, setZone] = useState('A');
  const [zoneNumber, setZoneNumber] = useState('');

  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');

  // Baptism Info State
  const [baptismStatus, setBaptismStatus] = useState<'baptised' | 'not_baptised'>('baptised');
  const [baptismDateType, setBaptismDateType] = useState('full');
  const [baptismFullDate, setBaptismFullDate] = useState('');
  const [baptismMonth, setBaptismMonth] = useState('');
  const [baptismYear, setBaptismYear] = useState('');
  const [previousCongregation, setPreviousCongregation] = useState('');
  const [roleInPreviousCongregation, setRoleInPreviousCongregation] = useState('');

  // Ministries & Positions
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

  // Legal Info
  const [ghanaCardNumber, setGhanaCardNumber] = useState('');
  const [ghanaCardExpiryDate, setGhanaCardExpiryDate] = useState('');
  const [alternativeIdType, setAlternativeIdType] = useState('');
  const [alternativeIdNumber, setAlternativeIdNumber] = useState('');

  // Family Members
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberItem[]>([]);

  useEffect(() => {
    async function loadDynamicMetadata() {
      try {
        const [z, m, p] = await Promise.all([
          getChurchZones(),
          getDropdownOptions('ministries'),
          getDropdownOptions('position_held')
        ]);
        if (z.length > 0) setZonesList(z);
        if (m.length > 0) setMinistriesList(m);
        else setMinistriesList(['Choir', 'Protocol', 'Media & IT', 'Evangelism', 'Prayer Warriors', 'Ushering', 'Welfare', 'Children Teachers']);
        if (p.length > 0) setPositionsList(p);
        else setPositionsList(['Pastor', 'Elder', 'Deacon', 'Deaconess', 'Ministry Leader', 'Executive Member', 'General Member']);

        // Load adult member directory for family linking
        const db = await getLocalDb();
        const roster = await db.getAllAsync<LocalMember>('SELECT * FROM members ORDER BY name ASC');
        if (roster) setMemberRoster(roster);
      } catch (err) {
        console.warn('Error fetching dynamic options in EditMember:', err);
      }
    }
    loadDynamicMetadata();
  }, []);

  useEffect(() => {
    if (!id) return;

    const loadMember = async () => {
      setLoading(true);
      try {
        const db = await getLocalDb();
        const row = await db.getFirstAsync<LocalMember>('SELECT * FROM members WHERE id = ?', [id]);
        
        let data: any = null;
        if (row && row.raw_json) {
          try { data = JSON.parse(row.raw_json); } catch (e) {}
        }

        if (!data) {
          const { data: remote } = await supabase.from('members').select('*').eq('id', id).single();
          if (remote) data = remote;
        }

        if (data) {
          setFirstName(data.firstName || data.first_name || (data.name || '').split(' ')[0] || '');
          setLastName(data.lastName || data.last_name || (data.name || '').split(' ').slice(1).join(' ') || '');
          setOtherNames(data.otherNames || data.other_names || '');
          setGender(data.gender || 'male');
          setMaritalStatus(data.maritalStatus || data.marital_status || 'single');
          setDateOfBirth(data.dateOfBirth || data.date_of_birth || '1990-01-01');
          setOccupation(data.occupation || '');
          setHometown(data.hometown || '');

          setPhone(data.phone || data.primary_phone || '');
          setSecondPhone(data.secondPhone || data.second_phone || '');
          setEmail(data.email || '');

          setResidenceLocation(data.residenceLocation || data.residence_location || '');
          setDigitalAddress(data.digitalAddress || data.digital_address || '');
          setZone(data.zone || 'A');
          setZoneNumber(data.zoneNumber || data.zone_number || '');

          setStatus(data.status || 'active');
          setNotes(data.notes || '');

          if (data.baptismInfo || data.baptism_info) {
            const b = typeof data.baptismInfo === 'object' ? data.baptismInfo : (typeof data.baptism_info === 'string' ? JSON.parse(data.baptism_info) : data.baptism_info || {});
            setBaptismStatus(b.baptismStatus || 'baptised');
            setBaptismDateType(b.dateType || 'full');
            setBaptismFullDate(b.fullDate || '');
            setBaptismMonth(b.month || '');
            setBaptismYear(b.year || '');
            setPreviousCongregation(b.previousCongregation || '');
            setRoleInPreviousCongregation(b.roleInPreviousCongregation || '');
          }

          setSelectedMinistries(Array.isArray(data.ministries) ? data.ministries : (data.ministry ? [data.ministry] : []));
          setSelectedPositions(Array.isArray(data.positionHeld) ? data.positionHeld : (data.position_held ? data.position_held : (data.role ? [data.role] : [])));

          if (data.legalInfo || data.legal_info) {
            const leg = typeof data.legalInfo === 'object' ? data.legalInfo : (typeof data.legal_info === 'string' ? JSON.parse(data.legal_info) : data.legal_info || {});
            setGhanaCardNumber(leg.ghanaCardNumber || '');
            setGhanaCardExpiryDate(leg.ghanaCardExpiryDate || '');
            setAlternativeIdType(leg.alternativeIdType || '');
            setAlternativeIdNumber(leg.alternativeIdNumber || '');
          }

          // Cache profile image if available
          const photo = data.photo || data.photo_url || data.photoUrl;
          if (photo) {
            getOrCacheProfilePhoto(id, photo).then(cached => {
              if (cached) setAvatarUri(cached);
            }).catch(() => {});
          }

          // Load family members from SQLite or resolve from network
          try {
            const localFm = await getLocalFamilyMembers(id as string);
            if (localFm && localFm.length > 0) {
              setFamilyMembers(localFm.map(f => ({
                id: f.id,
                relationship: (f.relationship as any) || 'sibling',
                firstName: f.first_name,
                lastName: f.last_name,
                otherNames: f.other_names,
                phone: f.phone,
                isLinked: !!f.is_linked,
                linkedMemberId: f.linked_member_id
              })));
            } else {
              const resolved = await resolveMemberFamily(id as string);
              if (resolved && resolved.length > 0) {
                setFamilyMembers(resolved.map(r => ({
                  id: r.id,
                  relationship: r.relationship,
                  firstName: r.firstName,
                  lastName: r.lastName,
                  otherNames: r.otherNames,
                  phone: r.phone,
                  isLinked: !!r.isLinked,
                  linkedMemberId: r.linkedMemberId
                })));
              }
            }
          } catch (fmErr) {
            console.warn('Error loading family members:', fmErr);
          }
        }
      } catch (err) {
        console.warn('Error loading member for edit:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMember();
  }, [id]);

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

    setSubmitting(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

      const updatedMemberData = {
        id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        otherNames: otherNames.trim() || undefined,
        gender,
        maritalStatus,
        dateOfBirth,
        occupation: occupation.trim() || undefined,
        hometown: hometown.trim() || undefined,
        phone: phone.trim(),
        secondPhone: secondPhone.trim() || undefined,
        email: email.trim() || undefined,
        residenceLocation: residenceLocation.trim(),
        digitalAddress: digitalAddress.trim() || undefined,
        zone,
        zoneNumber,
        status,
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

      // 1. Instant SQLite Local Write (0ms UI latency)
      await upsertLocalMember({
        id: id as string,
        name: fullName,
        phone,
        email,
        role: selectedPositions[0] || 'Member',
        zone,
        zone_number: zoneNumber,
        ministry: selectedMinistries[0],
        status,
        raw_json: JSON.stringify(updatedMemberData),
        created_at: new Date().toISOString()
      });

      // Save family members to local SQLite
      for (const fm of familyMembers) {
        if (fm.firstName.trim() || fm.lastName.trim()) {
          await upsertLocalFamilyMember({
            id: fm.id || generateUUID(),
            member_id: id as string,
            relationship: fm.relationship || 'sibling',
            first_name: fm.firstName.trim(),
            last_name: fm.lastName.trim(),
            other_names: fm.otherNames || undefined,
            phone: fm.phone || undefined,
            is_linked: fm.isLinked ? 1 : 0,
            linked_member_id: fm.linkedMemberId || undefined,
            created_at: new Date().toISOString()
          });
        }
      }

      // 2. Enqueue Outbox Queue Task for guaranteed offline persistence
      await enqueueSyncTask('member_update', `/members/${id}`, updatedMemberData);

      // 3. Live Server Update via Edge Function (handles family_members & reciprocal inverse links)
      try {
        await api.members.update(id as string, updatedMemberData);
      } catch (apiErr) {
        console.warn('API member update failed, queued offline:', apiErr);
      }

      Alert.alert('Success', 'Member profile updated successfully!');
      router.back();

    } catch (err) {
      console.warn('Error saving member update:', err);
      Alert.alert('Error', 'Failed to save member update.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
        <Spinner size="large" color="#007AFF" />
        <Text color="$colorPress" marginTop="$2" fontSize={13}>Loading member details...</Text>
      </YStack>
    );
  }

  const filteredMembers = memberRoster.filter(m => 
    !searchMemberQuery || m.name.toLowerCase().includes(searchMemberQuery.toLowerCase())
  );

  return (
    <YStack flex={1} backgroundColor="$background">
      <AppHeader
        title="Edit Member"
        subtitle={`Updating ${firstName} ${lastName}`}
        showBack
        backTitle="Profile"
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
                <Input value={firstName} onChangeText={setFirstName} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Last Name *</Text>
                <Input value={lastName} onChangeText={setLastName} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Other Names</Text>
                <Input value={otherNames} onChangeText={setOtherNames} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} />

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
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  placeholder="YYYY-MM-DD"
                  maxDate={new Date()}
                  accentColor="#007AFF"
                />

                <Text color="$colorPress" fontSize={12} fontWeight="600">Occupation</Text>
                <Input value={occupation} onChangeText={setOccupation} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} />

                <Text color="$colorPress" fontSize={12} fontWeight="600">Hometown</Text>
                <Input value={hometown} onChangeText={setHometown} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} />
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
                <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Secondary Phone</Text>
                <Input value={secondPhone} onChangeText={setSecondPhone} keyboardType="phone-pad" backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Email Address</Text>
                <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} />
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
                <Input value={residenceLocation} onChangeText={setResidenceLocation} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Digital Address</Text>
                <Input value={digitalAddress} onChangeText={setDigitalAddress} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Church Zone *</Text>
                <XStack space="$2" flexWrap="wrap">
                  {zonesList.map(z => (
                    <TouchableOpacity key={z} onPress={() => setZone(z)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: zone === z ? '#FF9500' : 'rgba(142,142,147,0.12)', marginBottom: 6 }}>
                      <Text color={zone === z ? '#FFFFFF' : '$color'} fontSize={12} fontWeight="700">Zone {z}</Text>
                    </TouchableOpacity>
                  ))}
                </XStack>

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Assigned Zone Number</Text>
                <Input value={zoneNumber} onChangeText={setZoneNumber} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} />
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

                {baptismStatus === 'baptised' ? (
                  <>
                    <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Date Record Type</Text>
                    <XStack space="$1.5" flexWrap="wrap">
                      {['full', 'monthYear', 'yearOnly', 'forgotten'].map(dt => (
                        <TouchableOpacity key={dt} onPress={() => setBaptismDateType(dt)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: baptismDateType === dt ? '#5856D6' : 'rgba(142,142,147,0.12)', marginBottom: 4 }}>
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
                    <Input value={previousCongregation} onChangeText={setPreviousCongregation} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} />

                    <Text color="$colorPress" fontSize={12} fontWeight="600">Role in Previous Congregation</Text>
                    <Input value={roleInPreviousCongregation} onChangeText={setRoleInPreviousCongregation} backgroundColor="$background" borderColor="$borderColor" borderRadius="$3" height={40} />
                  </>
                ) : null}
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
                <Text color="$colorPress" fontSize={12} textAlign="center" py="$2">No family members linked yet. Tap "+ Add Relative" above.</Text>
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
                <Text color="$colorPress" fontSize={12} fontWeight="600">Member Status</Text>
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
