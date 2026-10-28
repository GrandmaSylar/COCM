import React, { useState, useEffect, useMemo } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { getLocalDb, LocalMember, upsertLocalMember, upsertLocalFamilyMember, getLocalChildById, deleteLocalChild, getLocalVisitors, upsertLocalVisitor } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { getDropdownOptions, getChurchZones, syncDropdownOptions, syncChurchZones } from '../../lib/options';
import { generateUUID } from '../../lib/uuid';
import { pushOrQueue } from '../../lib/syncEngine';
import { AppHeader } from '../../components/AppHeader';
import { SaveBar, Screen, useToast } from '../../components/ui';
import { MemberForm, MemberFormBindings, MemberFormErrors, memberFormProgress } from '../../components/forms/MemberForm';
import { space } from '../../theme/tokens';

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
  // Set when promoting a child (mirrors the web app: pre-filled Add Member form,
  // child record removed once the member is saved)
  const { fromChildId, fromVisitorId } = useLocalSearchParams<{ fromChildId?: string; fromVisitorId?: string }>();
  const [promotedChildName, setPromotedChildName] = useState<string | null>(null);
  const [convertedVisitorName, setConvertedVisitorName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const [errors, setErrors] = useState<MemberFormErrors>({});

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
  const [photoUri, setPhotoUri] = useState<string | null>(null);
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
          if (!fromChildId && !fromVisitorId) setZone(zones[0]);
        }

        // Load adult member directory for family linking & duplicate zone check
        const db = await getLocalDb();
        const roster = await db.getAllAsync<LocalMember>('SELECT * FROM members ORDER BY name ASC');
        if (roster) setMemberRoster(roster);

        // Fetch fresh server members to guarantee 100% database coverage for duplicate detection
        const { data: remoteMembers } = await supabase.from('members').select('id, name, first_name, last_name, zone, zone_number, phone, primary_phone');
        if (remoteMembers && remoteMembers.length > 0) {
          setMemberRoster(prev => {
            const map = new Map<string, LocalMember>();
            for (const m of prev) map.set(m.id, m);
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
        console.warn('Error loading initial dropdown options & roster:', err);
      }
    };

    loadData();
    syncDropdownOptions();
    syncChurchZones();
  }, []);

  // Pre-fill from the child being promoted (same fields the web AddMember copies)
  useEffect(() => {
    if (!fromChildId) return;
    (async () => {
      const row = await getLocalChildById(fromChildId);
      if (!row) return;
      let child: any = {};
      try { child = JSON.parse(row.raw_json || '{}'); } catch {}

      const childFirst = child.firstName || row.first_name || row.name.split(' ')[0] || '';
      const childLast = child.lastName || row.last_name || row.name.split(' ').slice(1).join(' ') || '';
      setPromotedChildName(`${childFirst} ${childLast}`.trim());
      setFirstName(childFirst);
      setLastName(childLast);
      setOtherNames(child.otherNames || row.other_names || '');
      setPhone(child.phone || row.phone || '');
      if (child.gender || row.gender) setGender(child.gender || row.gender);
      setDateOfBirth((child.dateOfBirth || row.date_of_birth || '').slice(0, 10));
      setResidenceLocation(child.residenceLocation || row.residence_location || '');
      if (child.zone || row.zone) setZone(child.zone || row.zone);
      setNotes(child.notes || row.notes || '');

      if (Array.isArray(child.parents)) {
        setFamilyMembers(child.parents.map((p: any) => ({
          id: generateUUID(),
          relationship: p.relationship === 'mother' ? 'mother' : p.relationship === 'father' ? 'father' : 'sibling',
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          phone: p.phone,
          isLinked: !!p.isLinked,
          linkedMemberId: p.linkedMemberId,
        })));
      }
    })().catch(err => console.warn('Failed to pre-fill from child record:', err));
  }, [fromChildId]);

  // Pre-fill from the visitor being converted (same fields the web AddMember copies)
  useEffect(() => {
    if (!fromVisitorId) return;
    (async () => {
      let visitor: any = null;
      const row = (await getLocalVisitors()).find(v => v.id === fromVisitorId);
      if (row) {
        try { visitor = JSON.parse(row.raw_json || '{}'); } catch {}
        visitor = { ...visitor, firstName: visitor?.firstName || row.name.split(' ')[0], lastName: visitor?.lastName || row.name.split(' ').slice(1).join(' '), phone: visitor?.phone || row.phone, email: visitor?.email || row.email, potentialZone: visitor?.potentialZone || row.potential_zone, notes: visitor?.notes ?? row.notes };
      } else {
        visitor = await api.visitors.getById(fromVisitorId);
      }
      if (!visitor) return;
      setConvertedVisitorName(`${visitor.firstName || ''} ${visitor.lastName || ''}`.trim());
      setFirstName(visitor.firstName || '');
      setLastName(visitor.lastName || '');
      setOtherNames(visitor.otherNames || '');
      setEmail(visitor.email || '');
      setPhone(visitor.phone || '');
      setSecondPhone(visitor.secondPhone || '');
      if (visitor.gender) setGender(visitor.gender);
      setDateOfBirth((visitor.dateOfBirth || '').slice(0, 10));
      setResidenceLocation(visitor.residenceLocation || '');
      if (visitor.potentialZone) setZone(visitor.potentialZone);
      setNotes(`Converted from visitor. Original notes: ${visitor.notes || ''}`);
      setPreviousCongregation(visitor.church || '');
    })().catch(err => console.warn('Failed to pre-fill from visitor record:', err));
  }, [fromVisitorId]);

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

  // Verified DB Query: Check if zone number is already assigned to an existing member across SQLite & Remote DB
  const conflictingMember = useMemo(() => {
    if (!zoneNumber.trim()) return null;
    const target = zoneNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!target) return null;
    const targetFull = `${zone || ''}${target}`.replace(/[^A-Z0-9]/g, '');

    return memberRoster.find((m) => {
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
  }, [zoneNumber, zone, memberRoster]);

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
        setPhotoUri(result.assets[0].uri);
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
        setPhotoUri(result.assets[0].uri);
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
      phone: phone.trim() ? undefined : 'Enter a primary phone number.',
      zoneNumber: conflictingMember ? `Already assigned to ${conflictingMember.name}.` : undefined,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      toast.show({ title: 'Check the highlighted fields', tone: 'warning' });
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
        photo: photoUri || undefined,
        photoUrl: photoUri || undefined,
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
        photo_url: photoUri || undefined,
        local_photo_path: photoUri || undefined,
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

      // 2. Server push via Edge Function (handles family_members & bidirectional inverse links);
      //    queued in the outbox only if the server can't be reached.
      await pushOrQueue('POST', '/members', memberPayload);

      // 3. Promotion: the child record is replaced by the new member (web parity)
      if (fromChildId) {
        let childNote = '';
        try {
          await deleteLocalChild(fromChildId);
          await pushOrQueue('DELETE', `/children/members/${fromChildId}`);
        } catch (childErr) {
          console.warn('Failed to remove child record after promotion:', childErr);
          childNote = '\n\nThe child record could not be removed automatically; please delete it from the Children registry.';
        }
        toast.show({
          title: 'Promoted to adult member',
          message: childNote ? `${fullName}. The child record couldn’t be removed; delete it from Children.` : fullName,
          tone: childNote ? 'warning' : 'success',
        });
        // The child profile no longer exists, so leave the children stack entirely
        router.dismissAll();
        router.push(`/members/${newId}` as any);
        return;
      }

      // 4. Conversion: mark the visitor as converted and linked to the new member (web parity)
      if (fromVisitorId) {
        try {
          const row = (await getLocalVisitors()).find(v => v.id === fromVisitorId);
          let base: any = {};
          try { base = JSON.parse(row?.raw_json || '{}'); } catch {}
          const converted = {
            firstName: row?.name.split(' ')[0],
            lastName: row?.name.split(' ').slice(1).join(' '),
            phone: row?.phone,
            visitDate: row?.visit_date,
            ...base,
            id: fromVisitorId,
            convertedToMember: true,
            convertedMemberId: newId,
          };
          if (row) await upsertLocalVisitor({ ...row, follow_up_status: 'converted', raw_json: JSON.stringify(converted) });
          await pushOrQueue('PUT', `/visitors/${fromVisitorId}`, converted);
        } catch (visitorErr) {
          console.warn('Failed to mark visitor as converted:', visitorErr);
        }
        toast.show({ title: 'Visitor converted to member', message: fullName });
        if (router.canGoBack()) router.back();
        else router.replace('/members' as any);
        return;
      }

      toast.show({ title: 'Member added', message: fullName });
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/members' as any);
      }

    } catch (err) {
      console.error('Failed saving new member:', err);
      toast.show({ title: 'Couldn’t save member', message: 'Check your entries and try again.', tone: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMembers = memberRoster.filter(m => 
    !searchMemberQuery || m.name.toLowerCase().includes(searchMemberQuery.toLowerCase())
  );

  const form: MemberFormBindings = {
    photoUri, setPhotoUri, pickPhotoFromLibrary, takePhotoWithCamera,
    firstName, setFirstName: v => { setFirstName(v); if (errors.firstName) setErrors(e => ({ ...e, firstName: undefined })); },
    lastName, setLastName: v => { setLastName(v); if (errors.lastName) setErrors(e => ({ ...e, lastName: undefined })); },
    otherNames, setOtherNames, gender, setGender, maritalStatus, setMaritalStatus,
    dateOfBirth, setDateOfBirth, occupation, setOccupation, hometown, setHometown,
    phone, setPhone: v => { setPhone(v); if (errors.phone) setErrors(e => ({ ...e, phone: undefined })); },
    secondPhone, setSecondPhone, email, setEmail,
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
  const formProgress = memberFormProgress(form);

  return (
    <Screen>
      <AppHeader
        title={fromChildId ? 'Promote to member' : fromVisitorId ? 'Convert visitor to member' : 'New member'}
        subtitle={promotedChildName ? `Pre-filled from ${promotedChildName}'s child profile` : convertedVisitorName ? `Register ${convertedVisitorName} as a new member` : 'Register a congregation member'}
        showBack
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
          <MemberForm form={form} errors={errors} requirePhone />
        </ScrollView>
        <SaveBar
          label={submitting ? 'Saving…' : fromChildId ? 'Save & promote' : fromVisitorId ? 'Save & convert' : 'Save member'}
          loading={submitting}
          onPress={handleSave}
          progress={formProgress}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
