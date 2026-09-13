import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Alert, Modal, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  Plus, 
  Trash2, 
  Search, 
  Users, 
  Baby, 
  Check, 
  X 
} from '@tamagui/lucide-icons';
import { getLocalDb, LocalMember, LocalChild, getLocalChildById, upsertLocalChild, LocalChildParent, getLocalChildParents, upsertLocalChildParent } from '../../../lib/db';
import { getChurchZones } from '../../../lib/options';
import { api } from '../../../lib/api';
import { enqueueSyncTask } from '../../../lib/syncEngine';
import { NativeDatePicker } from '../../../components/NativeDatePicker';
import { AppHeader } from '../../../components/AppHeader';

export default function EditChildScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
  const [photo, setPhoto] = useState('');

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
          setPhoto(parsedData?.photo || parsedData?.photo_url || '');

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
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Validation Error', 'First Name and Last Name are required.');
      return;
    }

    if (!dateOfBirth.trim()) {
      Alert.alert('Validation Error', 'Date of Birth is required.');
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
        Alert.alert('Validation Error', 'This person is 18 or older. Only children under 18 can be registered in the Children Ministry.');
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
        photo_url: photo || undefined,
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
          photo,
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

      // 2. Outbox Queue Enqueue
      await enqueueSyncTask('child_update', `/children/members/${id}`, {
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

      // 3. Try live server update in background
      try {
        await api.children.members.update(id as string, {
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
          parents
        });
      } catch (e) {
        console.warn('Server sync error, queued offline:', e);
      }

      Alert.alert('Success', 'Child details updated successfully');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update child details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
        <Spinner size="large" color="#FF9500" />
        <Text color="$colorPress" marginTop="$2" fontSize={13}>Loading child form...</Text>
      </YStack>
    );
  }

  const filteredMembers = memberRoster.filter(m => 
    !searchMemberQuery || m.name.toLowerCase().includes(searchMemberQuery.toLowerCase())
  );

  return (
    <YStack flex={1} backgroundColor="$background">
      <AppHeader
        title="Edit Child Member"
        subtitle={`Updating ${firstName} ${lastName}`}
        showBack
        backTitle="Profile"
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

      <ScrollView style={{ flex: 1 }} backgroundColor="$background" contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
        <YStack space="$4">

          {/* Basic Information Card */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <Baby size={18} color="#FF9500" />
                <Text color="$color" fontSize={16} fontWeight="700">Basic Information</Text>
              </XStack>
              <Separator borderColor="$borderColor" />

              <YStack space="$2">
                <Text color="$colorPress" fontSize={12} fontWeight="600">First Name *</Text>
                <Input 
                  value={firstName} 
                  onChangeText={setFirstName} 
                  placeholder="e.g. Samuel" 
                  backgroundColor="$background" 
                  borderColor="$borderColor" 
                />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Last Name *</Text>
                <Input 
                  value={lastName} 
                  onChangeText={setLastName} 
                  placeholder="e.g. Mensah" 
                  backgroundColor="$background" 
                  borderColor="$borderColor" 
                />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Other Names</Text>
                <Input 
                  value={otherNames} 
                  onChangeText={setOtherNames} 
                  placeholder="e.g. Kwabena" 
                  backgroundColor="$background" 
                  borderColor="$borderColor" 
                />

                {/* Gender Selector */}
                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Gender *</Text>
                <XStack space="$3">
                  <Button 
                    flex={1} 
                    size="$3.5" 
                    backgroundColor={gender === 'male' ? '#007AFF' : '$background'} 
                    borderWidth={1} 
                    borderColor={gender === 'male' ? '#007AFF' : '$borderColor'}
                    onPress={() => setGender('male')}
                  >
                    <Text color={gender === 'male' ? '#FFFFFF' : '$color'} fontWeight="700">Boy / Male</Text>
                  </Button>

                  <Button 
                    flex={1} 
                    size="$3.5" 
                    backgroundColor={gender === 'female' ? '#FF2D55' : '$background'} 
                    borderWidth={1} 
                    borderColor={gender === 'female' ? '#FF2D55' : '$borderColor'}
                    onPress={() => setGender('female')}
                  >
                    <Text color={gender === 'female' ? '#FFFFFF' : '$color'} fontWeight="700">Girl / Female</Text>
                  </Button>
                </XStack>

                {/* Date of Birth */}
                <NativeDatePicker
                  label="Date of Birth (YYYY-MM-DD)"
                  required
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  placeholder="2016-05-14"
                  maxDate={new Date()}
                  accentColor="#FF9500"
                />

                {/* Status Selector */}
                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Status</Text>
                <XStack space="$3">
                  <Button 
                    flex={1} 
                    size="$3.5" 
                    backgroundColor={status === 'active' ? '#34C759' : '$background'} 
                    borderWidth={1} 
                    borderColor={status === 'active' ? '#34C759' : '$borderColor'}
                    onPress={() => setStatus('active')}
                  >
                    <Text color={status === 'active' ? '#FFFFFF' : '$color'} fontWeight="700">Active</Text>
                  </Button>

                  <Button 
                    flex={1} 
                    size="$3.5" 
                    backgroundColor={status === 'inactive' ? '#8E8E93' : '$background'} 
                    borderWidth={1} 
                    borderColor={status === 'inactive' ? '#8E8E93' : '$borderColor'}
                    onPress={() => setStatus('inactive')}
                  >
                    <Text color={status === 'inactive' ? '#FFFFFF' : '$color'} fontWeight="700">Inactive</Text>
                  </Button>
                </XStack>

                {/* Zone Selector */}
                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Church Zone</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <XStack space="$2" py="$1">
                    {churchZones.map((z) => (
                      <TouchableOpacity 
                        key={z.code} 
                        onPress={() => setZone(z.code)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderRadius: 8,
                          backgroundColor: zone === z.code ? '#FF9500' : 'rgba(255, 149, 0, 0.1)',
                          borderWidth: 1,
                          borderColor: zone === z.code ? '#FF9500' : 'transparent'
                        }}
                      >
                        <Text color={zone === z.code ? '#FFFFFF' : '#FF9500'} fontWeight="700" fontSize={12}>
                          Zone {z.code}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </XStack>
                </ScrollView>
              </YStack>
            </YStack>
          </Card>

          {/* Parents & Guardians Section */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <XStack space="$2" alignItems="center">
                  <Users size={18} color="#FF9500" />
                  <Text color="$color" fontSize={16} fontWeight="700">Parents & Guardians</Text>
                </XStack>
                <Button 
                  size="$2.5" 
                  backgroundColor="rgba(255, 149, 0, 0.15)" 
                  borderWidth={1} 
                  borderColor="#FF9500"
                  onPress={handleAddParent}
                  icon={<Plus size={13} color="#FF9500" />}
                >
                  <Text color="#FF9500" fontWeight="700" fontSize={11}>Add Guardian</Text>
                </Button>
              </XStack>
              <Separator borderColor="$borderColor" />

              {parents.length === 0 ? (
                <Text color="$colorPress" fontSize={12} textAlign="center" py="$2">
                  No parents or guardians linked yet. Tap "+ Add Guardian" above.
                </Text>
              ) : (
                <YStack space="$3">
                  {parents.map((parent, idx) => (
                    <Card key={parent.id} p="$3" borderRadius="$4" backgroundColor="$background" borderWidth={1} borderColor="$borderColor">
                      <YStack space="$2">
                        <XStack justifyContent="space-between" alignItems="center">
                          <Text color="#FF9500" fontWeight="800" fontSize={12}>Guardian #{idx + 1}</Text>
                          <TouchableOpacity onPress={() => handleRemoveParent(idx)}>
                            <Trash2 size={15} color="#FF3B30" />
                          </TouchableOpacity>
                        </XStack>

                        {/* Link from Church Member Directory Button */}
                        <Button 
                          size="$3" 
                          backgroundColor="rgba(0, 122, 255, 0.1)" 
                          borderWidth={1} 
                          borderColor="#007AFF"
                          onPress={() => openMemberPicker(idx)}
                          icon={<Search size={14} color="#007AFF" />}
                        >
                          <Text color="#007AFF" fontWeight="700" fontSize={12}>
                            {parent.isLinked ? '✓ Linked Church Member' : 'Select from Church Directory'}
                          </Text>
                        </Button>

                        <XStack space="$2">
                          <YStack flex={1}>
                            <Text color="$colorPress" fontSize={11} fontWeight="600">First Name</Text>
                            <Input 
                              value={parent.firstName} 
                              onChangeText={(val) => setParents(prev => prev.map((p, i) => i === idx ? { ...p, firstName: val } : p))} 
                              backgroundColor="$background" 
                              borderColor="$borderColor" 
                            />
                          </YStack>
                          <YStack flex={1}>
                            <Text color="$colorPress" fontSize={11} fontWeight="600">Last Name</Text>
                            <Input 
                              value={parent.lastName} 
                              onChangeText={(val) => setParents(prev => prev.map((p, i) => i === idx ? { ...p, lastName: val } : p))} 
                              backgroundColor="$background" 
                              borderColor="$borderColor" 
                            />
                          </YStack>
                        </XStack>

                        <Text color="$colorPress" fontSize={11} fontWeight="600">Contact Phone</Text>
                        <Input 
                          value={parent.phone || ''} 
                          onChangeText={(val) => setParents(prev => prev.map((p, i) => i === idx ? { ...p, phone: val } : p))} 
                          placeholder="e.g. +233242338616" 
                          backgroundColor="$background" 
                          borderColor="$borderColor" 
                        />

                        {/* Relationship Choice */}
                        <Text color="$colorPress" fontSize={11} fontWeight="600">Relationship</Text>
                        <XStack space="$2">
                          {(['mother', 'father', 'guardian'] as const).map((r) => (
                            <TouchableOpacity 
                              key={r} 
                              onPress={() => setParents(prev => prev.map((p, i) => i === idx ? { ...p, relationship: r } : p))}
                              style={{
                                flex: 1,
                                paddingVertical: 6,
                                borderRadius: 6,
                                backgroundColor: parent.relationship === r ? '#FF9500' : '$background',
                                borderWidth: 1,
                                borderColor: parent.relationship === r ? '#FF9500' : '#E5E5EA',
                                alignItems: 'center'
                              }}
                            >
                              <Text color={parent.relationship === r ? '#FFFFFF' : '$color'} fontSize={11} fontWeight="700" textTransform="capitalize">
                                {r}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </XStack>
                      </YStack>
                    </Card>
                  ))}
                </YStack>
              )}
            </YStack>
          </Card>

          {/* Contact & Location Card */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <Text color="$color" fontSize={16} fontWeight="700">Contact & Location</Text>
              <Separator borderColor="$borderColor" />

              <YStack space="$2">
                <Text color="$colorPress" fontSize={12} fontWeight="600">Residential Address / Area</Text>
                <Input 
                  value={residenceLocation} 
                  onChangeText={setResidenceLocation} 
                  placeholder="e.g. Tantra Hills, Accra" 
                  backgroundColor="$background" 
                  borderColor="$borderColor" 
                />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Digital Address</Text>
                <Input 
                  value={digitalAddress} 
                  onChangeText={setDigitalAddress} 
                  placeholder="e.g. GE-123-4567" 
                  backgroundColor="$background" 
                  borderColor="$borderColor" 
                />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Hometown</Text>
                <Input 
                  value={hometown} 
                  onChangeText={setHometown} 
                  placeholder="e.g. Kumasi" 
                  backgroundColor="$background" 
                  borderColor="$borderColor" 
                />

                <Text color="$colorPress" fontSize={12} fontWeight="600" marginTop="$2">Additional Notes</Text>
                <Input 
                  value={notes} 
                  onChangeText={setNotes} 
                  placeholder="Special health notes, school, etc." 
                  backgroundColor="$background" 
                  borderColor="$borderColor" 
                />
              </YStack>
            </YStack>
          </Card>

        </YStack>
      </ScrollView>

      {/* Adult Member Selection Modal */}
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
                <TouchableOpacity onPress={() => selectMemberAsParent(item)}>
                  <XStack p="$3" borderRadius="$3" backgroundColor="$cardBackground" borderWidth={1} borderColor="$borderColor" marginBottom="$2" justifyContent="space-between" alignItems="center">
                    <YStack>
                      <Text color="$color" fontSize={14} fontWeight="700">{item.name}</Text>
                      <Text color="$colorPress" fontSize={12}>{item.phone || item.email || 'Member'}</Text>
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
