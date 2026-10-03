import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { getLocalDb, LocalMember, LocalChild, upsertLocalChild, upsertLocalChildParent } from '../../lib/db';
import { getChurchZones } from '../../lib/options';
import { pushOrQueue } from '../../lib/syncEngine';
import { generateUUID } from '../../lib/uuid';
import { AppHeader } from '../../components/AppHeader';
import { SaveBar, Screen, useToast } from '../../components/ui';
import { ChildForm, ChildFormBindings, ChildFormErrors } from '../../components/forms/ChildForm';
import { space } from '../../theme/tokens';

export default function AddChildScreen() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [errors, setErrors] = useState<ChildFormErrors>({});

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [otherNames, setOtherNames] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [zone, setZone] = useState('');
  const [phone, setPhone] = useState('');
  const [secondPhone, setSecondPhone] = useState('');
  const [email, setEmail] = useState('');
  const [residenceLocation, setResidenceLocation] = useState('');
  const [digitalAddress, setDigitalAddress] = useState('');
  const [hometown, setHometown] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

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

  // Parents List
  interface ParentItem {
    id: string;
    firstName: string;
    lastName: string;
    otherNames?: string;
    phone?: string;
    relationship: 'mother' | 'father' | 'guardian';
    isLinked: boolean;
    linkedMemberId?: string;
  }
  const [parents, setParents] = useState<ParentItem[]>([]);

  // Church Zones & Adult Members for linkage
  const [churchZones, setChurchZones] = useState<Array<{ code: string; name: string }>>([]);
  const [memberRoster, setMemberRoster] = useState<LocalMember[]>([]);
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [activeParentIndex, setActiveParentIndex] = useState<number | null>(null);

  useEffect(() => {
    const initData = async () => {
      try {
        // Load church zones from SQLite
        const zones = await getChurchZones();
        setChurchZones(zones.map(z => ({ code: z, name: `Zone ${z}` })));
        if (zones.length > 0 && !zone) {
          setZone(zones[0]);
        }

        // Load adult members roster from SQLite
        const db = await getLocalDb();
        const adultMembers = await db.getAllAsync<LocalMember>('SELECT * FROM members ORDER BY name ASC');
        setMemberRoster(adultMembers);
      } catch (err) {
        console.warn('Failed to load initial data in AddChildScreen:', err);
      }
    };

    initData();
  }, []);

  const handleAddParent = () => {
    setParents(prev => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        firstName: '',
        lastName: '',
        phone: '',
        relationship: 'mother',
        isLinked: false
      }
    ]);
  };

  const handleRemoveParent = (idx: number) => {
    setParents(prev => prev.filter((_, i) => i !== idx));
  };

  const openMemberPicker = (idx: number) => {
    setActiveParentIndex(idx);
    setSearchMemberQuery('');
    setMemberPickerVisible(true);
  };

  const selectMemberAsParent = (member: LocalMember) => {
    if (activeParentIndex === null) return;
    const nameParts = member.name.split(' ');
    const fName = nameParts[0] || '';
    const lName = nameParts.slice(1).join(' ') || '';

    setParents(prev => prev.map((p, i) => {
      if (i === activeParentIndex) {
        return {
          ...p,
          firstName: fName,
          lastName: lName,
          phone: member.phone || p.phone,
          isLinked: true,
          linkedMemberId: member.id
        };
      }
      return p;
    }));

    setMemberPickerVisible(false);
    setActiveParentIndex(null);
  };

  const handleSave = async () => {
    const nextErrors: ChildFormErrors = {
      firstName: firstName.trim() ? undefined : 'Enter a first name.',
      lastName: lastName.trim() ? undefined : 'Enter a last name.',
      dateOfBirth: dateOfBirth.trim() ? undefined : 'Enter the date of birth.',
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      toast.show({ title: 'Check the highlighted fields', tone: 'warning' });
      return;
    }

    // Age validation: child must be < 18
    const dob = new Date(dateOfBirth);
    if (!isNaN(dob.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
      if (age >= 18) {
        setErrors({ dateOfBirth: 'This person is 18 or older. Only children under 18 can be registered.' });
        return;
      }
    }

    setSaving(true);
    try {
      const newId = generateUUID();
      const now = new Date().toISOString();

      const newChild: LocalChild = {
        id: newId,
        name: `${firstName.trim()} ${lastName.trim()}`,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        other_names: otherNames.trim() || undefined,
        date_of_birth: dateOfBirth,
        gender,
        zone: zone || undefined,
        status,
        phone: phone.trim() || undefined,
        second_phone: secondPhone.trim() || undefined,
        email: email.trim() || undefined,
        residence_location: residenceLocation.trim() || undefined,
        digital_address: digitalAddress.trim() || undefined,
        hometown: hometown.trim() || undefined,
        notes: notes.trim() || undefined,
        photo_url: photoUri || undefined,
        guardian_name: parents[0] ? `${parents[0].firstName} ${parents[0].lastName}` : undefined,
        guardian_phone: parents[0]?.phone,
        raw_json: JSON.stringify({
          id: newId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          otherNames: otherNames.trim() || undefined,
          dateOfBirth,
          gender,
          status,
          zone,
          phone: phone.trim() || undefined,
          secondPhone: secondPhone.trim() || undefined,
          email: email.trim() || undefined,
          residenceLocation: residenceLocation.trim() || undefined,
          digitalAddress: digitalAddress.trim() || undefined,
          hometown: hometown.trim() || undefined,
          notes: notes.trim() || undefined,
          photo: photoUri || undefined,
          photoUrl: photoUri || undefined,
          parents
        }),
        created_at: now
      };

      // 1. 0ms local SQLite insert
      await upsertLocalChild(newChild);

      // Save parents to SQLite
      for (const p of parents) {
        const parentId = p.id.startsWith('temp-') ? generateUUID() : p.id;
        await upsertLocalChildParent({
          id: parentId,
          child_member_id: newId,
          first_name: p.firstName,
          last_name: p.lastName,
          other_names: p.otherNames,
          phone: p.phone,
          relationship: p.relationship,
          is_linked: p.isLinked ? 1 : 0,
          linked_member_id: p.linkedMemberId,
          created_at: now
        });
      }

      // 2. Server push; queued in the outbox only if the server can't be reached
      await pushOrQueue('POST', '/children/members', {
        id: newId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        otherNames: otherNames.trim() || undefined,
        gender,
        dateOfBirth,
        status,
        zone,
        phone: phone.trim() || undefined,
        secondPhone: secondPhone.trim() || undefined,
        email: email.trim() || undefined,
        residenceLocation: residenceLocation.trim() || undefined,
        digitalAddress: digitalAddress.trim() || undefined,
        hometown: hometown.trim() || undefined,
        notes: notes.trim() || undefined,
        photo: photoUri || undefined,
        photoUrl: photoUri || undefined,
        parents: parents.map(p => ({
          firstName: p.firstName,
          lastName: p.lastName,
          otherNames: p.otherNames,
          phone: p.phone,
          relationship: p.relationship,
          isLinked: p.isLinked,
          linkedMemberId: p.linkedMemberId
        }))
      });

      toast.show({ title: 'Child added', message: `${firstName.trim()} ${lastName.trim()}` });
      router.back();
    } catch (err: any) {
      toast.show({ title: 'Couldn’t save child', message: err.message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const filteredMembers = memberRoster.filter(m => 
    !searchMemberQuery || m.name.toLowerCase().includes(searchMemberQuery.toLowerCase())
  );

  const form: ChildFormBindings = {
    photoUri: photoUri, setPhotoUri: setPhotoUri, pickPhotoFromLibrary, takePhotoWithCamera,
    firstName, setFirstName: v => { setFirstName(v); if (errors.firstName) setErrors(e => ({ ...e, firstName: undefined })); },
    lastName, setLastName: v => { setLastName(v); if (errors.lastName) setErrors(e => ({ ...e, lastName: undefined })); },
    otherNames, setOtherNames, gender, setGender,
    dateOfBirth, setDateOfBirth: v => { setDateOfBirth(v); if (errors.dateOfBirth) setErrors(e => ({ ...e, dateOfBirth: undefined })); },
    status, setStatus,
    zones: churchZones.map(z => z.code), zone, setZone,
    parents,
    updateParent: (idx, patch) => setParents(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p))),
    handleAddParent, handleRemoveParent, openMemberPicker,
    memberPickerVisible, setMemberPickerVisible, searchMemberQuery, setSearchMemberQuery,
    filteredMembers, selectMemberAsParent,
    residenceLocation, setResidenceLocation, digitalAddress, setDigitalAddress, hometown, setHometown, notes, setNotes,
  };

  return (
    <Screen>
      <AppHeader title="New child" subtitle={'Register in the children’s ministry'} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
          <ChildForm form={form} errors={errors} />
        </ScrollView>
        <SaveBar label={saving ? 'Saving…' : 'Save child'} loading={saving} onPress={handleSave} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
