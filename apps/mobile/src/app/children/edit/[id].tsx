import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getLocalDb, LocalMember, LocalChild, getLocalChildById, upsertLocalChild, getLocalChildParents, upsertLocalChildParent } from '../../../lib/db';
import { getChurchZones } from '../../../lib/options';
import { pushOrQueue } from '../../../lib/syncEngine';
import { AppHeader } from '../../../components/AppHeader';
import { SkeletonForm } from '../../../components/Skeleton';
import { SaveBar, Screen, useToast } from '../../../components/ui';
import { ChildForm, ChildFormBindings, ChildFormErrors } from '../../../components/forms/ChildForm';
import { space } from '../../../theme/tokens';

export default function EditChildScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
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
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

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

        // Load adult members roster from SQLite
        const db = await getLocalDb();
        const adultMembers = await db.getAllAsync<LocalMember>('SELECT * FROM members ORDER BY name ASC');
        setMemberRoster(adultMembers);

        if (!id) return;

        // Load child record from SQLite
        const local = await getLocalChildById(id);
        const localParents = await getLocalChildParents(id);

        if (local) {
          let parsedData: any = null;
          if (local.raw_json) {
            try { parsedData = JSON.parse(local.raw_json); } catch (e) {}
          }

          const fName = parsedData?.firstName || parsedData?.first_name || local.name?.split(' ')[0] || '';
          const lName = parsedData?.lastName || parsedData?.last_name || local.name?.split(' ').slice(1).join(' ') || '';

          setFirstName(fName);
          setLastName(lName);
          setOtherNames(parsedData?.otherNames || parsedData?.other_names || '');
          setGender(parsedData?.gender || local.gender || 'male');
          setDateOfBirth(parsedData?.dateOfBirth || parsedData?.date_of_birth || local.date_of_birth || '');
          setStatus(parsedData?.status || local.status || 'active');
          setZone(parsedData?.zone || local.zone || '');
          setPhone(parsedData?.phone || '');
          setSecondPhone(parsedData?.secondPhone || '');
          setEmail(parsedData?.email || '');
          setResidenceLocation(parsedData?.residenceLocation || '');
          setDigitalAddress(parsedData?.digitalAddress || '');
          setHometown(parsedData?.hometown || '');
          setNotes(parsedData?.notes || '');
          const img = parsedData?.photo || parsedData?.photo_url || local.photo_url || '';
          if (img) setAvatarUri(img);

          if (parsedData?.parents && Array.isArray(parsedData.parents)) {
            setParents(parsedData.parents.map((p: any) => ({
              id: p.id || Math.random().toString(),
              firstName: p.firstName || p.first_name || '',
              lastName: p.lastName || p.last_name || '',
              otherNames: p.otherNames || p.other_names,
              phone: p.phone,
              relationship: p.relationship || 'guardian',
              isLinked: !!p.isLinked || !!p.is_linked,
              linkedMemberId: p.linkedMemberId || p.linked_member_id
            })));
          } else if (localParents && localParents.length > 0) {
            setParents(localParents.map((lp) => ({
              id: lp.id,
              firstName: lp.first_name,
              lastName: lp.last_name,
              otherNames: lp.other_names,
              phone: lp.phone,
              relationship: (lp.relationship as any) || 'guardian',
              isLinked: !!lp.is_linked,
              linkedMemberId: lp.linked_member_id
            })));
          }
        }
      } catch (err) {
        console.warn('Failed to initialize edit child form:', err);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [id]);

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

    // Age validation
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
      const updatedChild: LocalChild = {
        id: id as string,
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
        photo_url: avatarUri || undefined,
        guardian_name: parents[0] ? `${parents[0].firstName} ${parents[0].lastName}` : undefined,
        guardian_phone: parents[0]?.phone,
        raw_json: JSON.stringify({
          id,
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
          photo: avatarUri || undefined,
          photoUrl: avatarUri || undefined,
          parents
        }),
        created_at: new Date().toISOString()
      };

      // 1. 0ms local SQLite update
      await upsertLocalChild(updatedChild);

      // Save parents to SQLite
      for (const p of parents) {
        await upsertLocalChildParent({
          id: p.id,
          child_member_id: id as string,
          first_name: p.firstName,
          last_name: p.lastName,
          other_names: p.otherNames,
          phone: p.phone,
          relationship: p.relationship,
          is_linked: p.isLinked ? 1 : 0,
          linked_member_id: p.linkedMemberId,
          created_at: new Date().toISOString()
        });
      }

      // 2. Server push; queued in the outbox only if the server can't be reached
      await pushOrQueue('PUT', `/children/members/${id}`, {
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
        photo: avatarUri || undefined,
        photoUrl: avatarUri || undefined,
        parents: parents.map(p => ({
          id: p.id.startsWith('temp-') ? undefined : p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          otherNames: p.otherNames,
          phone: p.phone,
          relationship: p.relationship,
          isLinked: p.isLinked,
          linkedMemberId: p.linkedMemberId
        }))
      });

      toast.show({ title: 'Changes saved', message: `${firstName.trim()} ${lastName.trim()}` });
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

  if (loading) {
    return (
      <Screen>
        <AppHeader title="Edit child" showBack />
        <SkeletonForm />
      </Screen>
    );
  }

  const form: ChildFormBindings = {
    photoUri: avatarUri, setPhotoUri: setAvatarUri, pickPhotoFromLibrary, takePhotoWithCamera,
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
      <AppHeader title="Edit child" subtitle={`${firstName} ${lastName}`.trim()} showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
          <ChildForm form={form} errors={errors} />
        </ScrollView>
        <SaveBar label={saving ? 'Saving…' : 'Save changes'} loading={saving} onPress={handleSave} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
