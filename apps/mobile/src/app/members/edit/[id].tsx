import React, { useEffect, useState, useMemo } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getLocalDb, LocalMember, upsertLocalMember, upsertLocalFamilyMember, getLocalFamilyMembers } from '../../../lib/db';
import { getOrCacheProfilePhoto } from '../../../lib/photoCache';
import { supabase } from '../../../lib/supabase';
import { getDropdownOptions, getChurchZones } from '../../../lib/options';
import { pushOrQueue } from '../../../lib/syncEngine';
import { generateUUID } from '../../../lib/uuid';
import { resolveMemberFamily } from '../../../lib/family';
import { AppHeader } from '../../../components/AppHeader';
import { SkeletonForm } from '../../../components/Skeleton';
import { SaveBar, Screen, useToast } from '../../../components/ui';
import { MemberForm, MemberFormBindings, MemberFormErrors } from '../../../components/forms/MemberForm';
import { space } from '../../../theme/tokens';

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
  const toast = useToast();
  const [errors, setErrors] = useState<MemberFormErrors>({});
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

  // Verified DB Query: Check if zone number is already assigned to an existing member in SQLite / Remote DB (excluding current member)
  const conflictingMember = useMemo(() => {
    if (!zoneNumber.trim()) return null;
    const target = zoneNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!target) return null;
    const targetFull = `${zone || ''}${target}`.replace(/[^A-Z0-9]/g, '');

    return memberRoster.find((m) => {
      if (m.id === id) return false;
      let mZoneNumber = m.zone_number || '';
      if (!mZoneNumber && m.raw_json) {
        try {
          const parsed = JSON.parse(m.raw_json);
          mZoneNumber = parsed.zoneNumber || parsed.zone_number || '';
        } catch (e) {}
      }
      const mNum = mZoneNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!mNum) return false;
      const mFull = `${m.zone || ''}${mNum}`.replace(/[^A-Z0-9]/g, '');

      return mNum === target || mNum === targetFull || mFull === target || mFull === targetFull;
    }) || null;
  }, [zoneNumber, zone, memberRoster, id]);

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

        // Load adult member directory for family linking & duplicate zone check
        const db = await getLocalDb();
        const roster = await db.getAllAsync<LocalMember>('SELECT * FROM members ORDER BY name ASC');
        if (roster) setMemberRoster(roster);

        // Fetch fresh server members to guarantee 100% database coverage for duplicate detection
        const { data: remoteMembers } = await supabase.from('members').select('id, name, first_name, last_name, zone, zone_number, phone, primary_phone');
        if (remoteMembers && remoteMembers.length > 0) {
          setMemberRoster(prev => {
            const map = new Map<string, LocalMember>();
            for (const item of prev) map.set(item.id, item);
            for (const r of remoteMembers) {
              const prevItem = map.get(r.id);
              map.set(r.id, {
                id: r.id,
                name: r.name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
                zone: r.zone || prevItem?.zone,
                zone_number: r.zone_number || prevItem?.zone_number,
                phone: r.phone || r.primary_phone || prevItem?.phone,
                created_at: prevItem?.created_at || new Date().toISOString()
              });
            }
            return Array.from(map.values());
          });
        }
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

  const pickPhotoFromLibrary = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Permission to access media library is required to select a profile photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('Image picker error:', err);
      Alert.alert('Error', 'Could not open photo library.');
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Permission to access camera is required to take a profile photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('Camera error:', err);
      Alert.alert('Error', 'Could not open camera.');
    }
  };

  const handleSave = async () => {
    const nextErrors: MemberFormErrors = {
      firstName: firstName.trim() ? undefined : 'Enter a first name.',
      lastName: lastName.trim() ? undefined : 'Enter a last name.',
      zoneNumber: conflictingMember ? `Already assigned to ${conflictingMember.name}.` : undefined,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      toast.show({ title: 'Check the highlighted fields', tone: 'warning' });
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
        photo: avatarUri || undefined,
        photoUrl: avatarUri || undefined,
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
        photo_url: avatarUri || undefined,
        local_photo_path: avatarUri || undefined,
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

      // 2. Live Server Update via Edge Function (handles family_members & reciprocal inverse links);
      //    queued in the outbox only if the server can't be reached.
      await pushOrQueue('PUT', `/members/${id}`, updatedMemberData);

      toast.show({ title: 'Changes saved', message: fullName });
      router.back();

    } catch (err) {
      console.warn('Error saving member update:', err);
      toast.show({ title: 'Couldn’t save changes', message: 'Check your entries and try again.', tone: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMembers = memberRoster.filter(m => 
    !searchMemberQuery || m.name.toLowerCase().includes(searchMemberQuery.toLowerCase())
  );

  if (loading) {
    return (
      <Screen>
        <AppHeader title="Edit member" showBack />
        <SkeletonForm />
      </Screen>
    );
  }

  const form: MemberFormBindings = {
    photoUri: avatarUri, setPhotoUri: setAvatarUri, pickPhotoFromLibrary, takePhotoWithCamera,
    firstName, setFirstName: v => { setFirstName(v); if (errors.firstName) setErrors(e => ({ ...e, firstName: undefined })); },
    lastName, setLastName: v => { setLastName(v); if (errors.lastName) setErrors(e => ({ ...e, lastName: undefined })); },
    otherNames, setOtherNames, gender, setGender, maritalStatus, setMaritalStatus,
    dateOfBirth, setDateOfBirth, occupation, setOccupation, hometown, setHometown,
    phone, setPhone, secondPhone, setSecondPhone, email, setEmail,
    residenceLocation, setResidenceLocation, digitalAddress, setDigitalAddress,
    zonesList, zone, setZone,
    zoneNumber, setZoneNumber: v => { setZoneNumber(v); if (errors.zoneNumber) setErrors(e => ({ ...e, zoneNumber: undefined })); },
    conflictingMember,
    baptismStatus, setBaptismStatus, baptismDateType, setBaptismDateType, baptismFullDate, setBaptismFullDate,
    baptismMonth, setBaptismMonth, baptismYear, setBaptismYear,
    previousCongregation, setPreviousCongregation, roleInPreviousCongregation, setRoleInPreviousCongregation,
    ministriesList, selectedMinistries, toggleMinistry, positionsList, selectedPositions, togglePosition,
    familyMembers, handleAddFamilyMember, handleRemoveFamilyMember, handleUpdateFamilyMember, openMemberPicker,
    memberPickerVisible, setMemberPickerVisible, searchMemberQuery, setSearchMemberQuery,
    filteredMembers, selectMemberAsRelative,
    statuses: MEMBER_STATUSES, status, setStatus, notes, setNotes,
  };

  return (
    <Screen>
      <AppHeader title="Edit member" subtitle={`${firstName} ${lastName}`.trim()} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
          <MemberForm form={form} errors={errors} />
        </ScrollView>
        <SaveBar label={submitting ? 'Saving…' : 'Save changes'} loading={submitting} onPress={handleSave} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
