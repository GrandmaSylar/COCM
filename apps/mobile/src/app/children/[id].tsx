import React, { useEffect, useState } from 'react';
import { Image, Linking, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  YStack, 
  XStack, 
  Text, 
  Card, 
  Paragraph, 
  Button, 
  Separator, 
  Spinner,
  ScrollView 
} from 'tamagui';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Edit3,
  Trash2,
  Users,
  ExternalLink,
  CheckCircle,
  Baby,
  UserCheck,
  Award
} from '@tamagui/lucide-icons';
import { getLocalDb, LocalChild, getLocalChildById, deleteLocalChild, LocalChildParent, getLocalChildParents, upsertLocalChild } from '../../lib/db';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { AppHeader } from '../../components/AppHeader';

interface ChildParent {
  id: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  phone?: string;
  relationship: string;
  isLinked?: boolean;
  linkedMemberId?: string;
}

interface FullChildData {
  id: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  status: 'active' | 'inactive';
  zone?: string;
  phone?: string;
  secondPhone?: string;
  email?: string;
  residenceLocation?: string;
  digitalAddress?: string;
  hometown?: string;
  joinDate?: string;
  notes?: string;
  photo?: string;
  parents: ChildParent[];
}

export default function ChildProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [childData, setChildData] = useState<FullChildData | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceStats, setAttendanceStats] = useState<{
    totalServices: number;
    totalPresent: number;
    percentage: number;
    records: Array<{ date: string; serviceType: string; status: 'present' | 'absent' }>;
  }>({
    totalServices: 4,
    totalPresent: 3,
    percentage: 75,
    records: []
  });

  const calculateAge = (dob?: string) => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  useEffect(() => {
    if (!id) return;

    const loadChildProfile = async () => {
      try {
        // 1. Load from local SQLite for 0ms visual rendering
        const local = await getLocalChildById(id);
        const localParents = await getLocalChildParents(id);

        let initial: FullChildData | null = null;
        if (local && local.raw_json) {
          try {
            const parsed = JSON.parse(local.raw_json);
            initial = {
              id: parsed.id || local.id,
              firstName: parsed.firstName || parsed.first_name || local.name?.split(' ')[0] || 'Child',
              lastName: parsed.lastName || parsed.last_name || local.name?.split(' ').slice(1).join(' ') || '',
              otherNames: parsed.otherNames || parsed.other_names,
              dateOfBirth: parsed.dateOfBirth || parsed.date_of_birth || local.date_of_birth,
              gender: (parsed.gender || local.gender || 'male') as any,
              status: (parsed.status || local.status || 'active') as any,
              zone: parsed.zone || local.zone,
              phone: parsed.phone || parsed.primary_phone,
              secondPhone: parsed.secondPhone || parsed.second_phone,
              email: parsed.email,
              residenceLocation: parsed.residenceLocation || parsed.residence_location,
              digitalAddress: parsed.digitalAddress || parsed.digital_address,
              hometown: parsed.hometown,
              joinDate: parsed.joinDate || parsed.created_at || local.created_at,
              notes: parsed.notes,
              photo: parsed.photo || parsed.photo_url,
              parents: (parsed.parents || []).map((p: any) => ({
                id: p.id,
                firstName: p.firstName || p.first_name || '',
                lastName: p.lastName || p.last_name || '',
                otherNames: p.otherNames || p.other_names,
                phone: p.phone,
                relationship: p.relationship || 'Guardian',
                isLinked: !!p.isLinked || !!p.is_linked,
                linkedMemberId: p.linkedMemberId || p.linked_member_id
              }))
            };
          } catch (e) {
            console.warn('Failed parsing local child raw_json:', e);
          }
        }

        if (!initial && local) {
          const nameParts = (local.name || 'Child').split(' ');
          initial = {
            id: local.id,
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(' ') || '',
            dateOfBirth: local.date_of_birth,
            gender: (local.gender || 'male') as any,
            status: (local.status || 'active') as any,
            zone: local.zone,
            joinDate: local.created_at,
            parents: localParents.map((lp) => ({
              id: lp.id,
              firstName: lp.first_name,
              lastName: lp.last_name,
              otherNames: lp.other_names,
              phone: lp.phone,
              relationship: lp.relationship,
              isLinked: !!lp.is_linked,
              linkedMemberId: lp.linked_member_id
            }))
          };
        }

        if (initial) {
          setChildData(initial);
          setLoading(false);
        }

        // 2. Fetch fresh details from Server API
        try {
          const remote = await api.children.members.getById(id);
          if (remote && remote.id) {
            const fresh: FullChildData = {
              id: remote.id,
              firstName: remote.firstName || '',
              lastName: remote.lastName || '',
              otherNames: remote.otherNames,
              dateOfBirth: remote.dateOfBirth || initial?.dateOfBirth || '2015-01-01',
              gender: remote.gender || 'male',
              status: remote.status || 'active',
              zone: remote.zone,
              phone: remote.phone,
              secondPhone: remote.secondPhone,
              email: remote.email,
              residenceLocation: remote.residenceLocation,
              digitalAddress: remote.digitalAddress,
              hometown: remote.hometown,
              joinDate: remote.joinDate || remote.createdAt,
              notes: remote.notes,
              photo: remote.photo || remote.photoUrl,
              parents: (remote.parents || []).map((p: any) => ({
                id: p.id,
                firstName: p.firstName || p.first_name || '',
                lastName: p.lastName || p.last_name || '',
                otherNames: p.otherNames || p.other_names,
                phone: p.phone,
                relationship: p.relationship || 'Guardian',
                isLinked: !!p.isLinked || !!p.is_linked,
                linkedMemberId: p.linkedMemberId || p.linked_member_id
              }))
            };

            setChildData(fresh);

            // Update SQLite cache
            await upsertLocalChild({
              id: fresh.id,
              name: `${fresh.firstName} ${fresh.lastName}`.trim(),
              date_of_birth: fresh.dateOfBirth,
              gender: fresh.gender,
              zone: fresh.zone,
              status: fresh.status,
              guardian_name: fresh.parents[0] ? `${fresh.parents[0].firstName} ${fresh.parents[0].lastName}` : undefined,
              guardian_phone: fresh.parents[0]?.phone,
              raw_json: JSON.stringify(fresh),
              created_at: fresh.joinDate || new Date().toISOString()
            });
          }

          // Fetch attendance history
          const historyRes = await api.children.members.getAttendanceHistory(id);
          if (historyRes && historyRes.summary) {
            setAttendanceStats({
              totalServices: historyRes.summary.totalServices || 0,
              totalPresent: historyRes.summary.totalPresent || 0,
              percentage: historyRes.summary.percentage || 0,
              records: historyRes.records || []
            });
          }
        } catch (serverErr) {
          console.warn('Server fetch error for child, using SQLite:', serverErr);
        }
      } catch (err) {
        console.warn('Error in loadChildProfile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadChildProfile();
  }, [id]);

  const handleCall = (phone?: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleDeleteChild = () => {
    if (!childData) return;
    Alert.alert(
      'Delete Child Record',
      `Are you sure you want to delete ${childData.firstName} ${childData.lastName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLocalChild(childData.id);
              await api.children.members.delete(childData.id);
              Alert.alert('Success', 'Child record deleted successfully');
              router.back();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete child record');
            }
          }
        }
      ]
    );
  };

  const handlePromoteToMember = () => {
    if (!childData) return;
    Alert.alert(
      'Promote to Adult Member',
      `Do you want to promote ${childData.firstName} ${childData.lastName} to the adult Church Members directory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            try {
              await api.children.members.promoteToMember(childData.id);
              Alert.alert('Success', `${childData.firstName} has been promoted to an Adult Member.`);
              router.replace('/members' as any);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to promote child member.');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
        <Spinner size="large" color="#FF9500" />
        <Text color="$colorPress" marginTop="$2" fontSize={13}>Loading child profile...</Text>
      </YStack>
    );
  }

  if (!childData) {
    return (
      <YStack flex={1} backgroundColor="$background">
        <AppHeader title="Child Details" showBack backTitle="Children" />
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
          <Text color="$color" fontSize={16} fontWeight="700">Child record not found</Text>
          <Paragraph color="$colorPress" fontSize={13} textAlign="center" marginTop="$1">
            The requested child record could not be found or has been removed.
          </Paragraph>
          <Button marginTop="$4" backgroundColor="#FF9500" borderRadius="$3" onPress={() => router.back()}>
            <Text color="#FFFFFF" fontWeight="700">Go Back to Children</Text>
          </Button>
        </YStack>
      </YStack>
    );
  }

  const age = calculateAge(childData.dateOfBirth);

  return (
    <YStack flex={1} backgroundColor="$background">
      <AppHeader
        title={`${childData.firstName} ${childData.lastName}`}
        subtitle="Child Profile Details"
        showBack
        backTitle="Children"
        rightElement={
          <TouchableOpacity
            onPress={() => router.push(`/children/edit/${childData.id}` as any)}
            style={{
              padding: 8,
              borderRadius: 8,
              backgroundColor: 'rgba(255, 149, 0, 0.12)',
            }}
          >
            <Edit3 size={18} color="#FF9500" />
          </TouchableOpacity>
        }
      />

      <ScrollView style={{ flex: 1 }} backgroundColor="$background" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <YStack space="$4">

          {/* Hero Header Card */}
          <Card 
            padding="$4" 
            borderRadius="$5" 
            backgroundColor="$cardBackground" 
            borderColor="$borderColor"
            borderWidth={1}
            alignItems="center"
            elevate
          >
            <YStack 
              width={84} 
              height={84} 
              borderRadius={42} 
              backgroundColor="rgba(255, 149, 0, 0.15)" 
              justifyContent="center" 
              alignItems="center" 
              marginBottom="$3"
              borderWidth={3}
              borderColor="#FF9500"
              overflow="hidden"
            >
              {childData.photo ? (
                <Image source={{ uri: childData.photo }} style={{ width: 80, height: 80, borderRadius: 40 }} />
              ) : (
                <Baby size={42} color="#FF9500" />
              )}
            </YStack>

            <Text color="$color" fontSize={20} fontWeight="800">
              {childData.firstName} {childData.lastName}
            </Text>
            {childData.otherNames ? (
              <Text color="$colorPress" fontSize={13}>({childData.otherNames})</Text>
            ) : null}

            {/* Badges Row */}
            <XStack space="$2" marginTop="$2.5" flexWrap="wrap" justifyContent="center">
              <XStack backgroundColor="rgba(255, 149, 0, 0.15)" px="$3" py="$1" borderRadius="$3">
                <Text color="#FF9500" fontSize={11} fontWeight="800">
                  {age !== null ? `${age} yrs old` : 'Youth'}
                </Text>
              </XStack>

              <XStack backgroundColor={childData.gender === 'male' ? 'rgba(0, 122, 255, 0.12)' : 'rgba(255, 45, 85, 0.12)'} px="$3" py="$1" borderRadius="$3">
                <Text color={childData.gender === 'male' ? '#007AFF' : '#FF2D55'} fontSize={11} fontWeight="800" textTransform="capitalize">
                  {childData.gender}
                </Text>
              </XStack>

              {childData.zone ? (
                <XStack backgroundColor="rgba(88, 86, 214, 0.12)" px="$3" py="$1" borderRadius="$3">
                  <Text color="#5856D6" fontSize={11} fontWeight="800">Zone {childData.zone}</Text>
                </XStack>
              ) : null}

              <XStack backgroundColor={childData.status === 'active' ? 'rgba(52, 199, 89, 0.15)' : 'rgba(142, 142, 147, 0.15)'} px="$3" py="$1" borderRadius="$3">
                <Text color={childData.status === 'active' ? '#34C759' : '#8E8E93'} fontSize={11} fontWeight="800" textTransform="capitalize">
                  {childData.status}
                </Text>
              </XStack>
            </XStack>

            {/* Quick Action Buttons */}
            <XStack space="$3" marginTop="$4" width="100%" justifyContent="center">
              <Button 
                flex={1} 
                size="$3.5" 
                backgroundColor="#FF9500" 
                borderRadius="$3"
                onPress={() => router.push(`/children/edit/${childData.id}` as any)}
                icon={<Edit3 size={15} color="#FFFFFF" />}
              >
                <Text color="#FFFFFF" fontWeight="700" fontSize={12}>Edit</Text>
              </Button>

              <Button 
                flex={1} 
                size="$3.5" 
                backgroundColor="rgba(0, 122, 255, 0.1)" 
                borderWidth={1}
                borderColor="#007AFF"
                borderRadius="$3"
                onPress={handlePromoteToMember}
                icon={<Award size={15} color="#007AFF" />}
              >
                <Text color="#007AFF" fontWeight="700" fontSize={12}>Promote</Text>
              </Button>

              <Button 
                size="$3.5" 
                backgroundColor="rgba(255, 59, 48, 0.1)" 
                borderWidth={1}
                borderColor="#FF3B30"
                borderRadius="$3"
                onPress={handleDeleteChild}
                icon={<Trash2 size={15} color="#FF3B30" />}
              />
            </XStack>
          </Card>

          {/* Parents & Guardians Card */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <Users size={18} color="#FF9500" />
                <Text color="$color" fontSize={16} fontWeight="700">Parents & Guardians</Text>
              </XStack>
              <Separator borderColor="$borderColor" />

              {childData.parents && childData.parents.length > 0 ? (
                <YStack space="$2.5">
                  {childData.parents.map((p) => (
                    <XStack 
                      key={p.id}
                      p="$3"
                      borderRadius="$4"
                      backgroundColor="$background"
                      borderColor="$borderColor"
                      borderWidth={1}
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <YStack flex={1}>
                        <XStack space="$2" alignItems="center">
                          <Text color="$color" fontSize={14} fontWeight="700">{p.firstName} {p.lastName}</Text>
                          {p.isLinked ? (
                            <XStack backgroundColor="rgba(52, 199, 89, 0.15)" px="$2" py="$0.5" borderRadius="$2">
                              <Text color="#34C759" fontSize={10} fontWeight="800">Church Member</Text>
                            </XStack>
                          ) : null}
                        </XStack>
                        <Text color="$colorPress" fontSize={12} textTransform="capitalize" marginTop="$1">
                          {p.relationship} {p.phone ? `• ${p.phone}` : ''}
                        </Text>
                      </YStack>

                      <XStack space="$2" alignItems="center">
                        {p.phone ? (
                          <TouchableOpacity 
                            onPress={() => handleCall(p.phone)}
                            style={{
                              padding: 8,
                              borderRadius: 18,
                              backgroundColor: 'rgba(52, 199, 89, 0.12)'
                            }}
                          >
                            <Phone size={14} color="#34C759" />
                          </TouchableOpacity>
                        ) : null}

                        {p.isLinked && p.linkedMemberId ? (
                          <TouchableOpacity 
                            onPress={() => router.push(`/members/${p.linkedMemberId}` as any)}
                            style={{
                              padding: 8,
                              borderRadius: 18,
                              backgroundColor: 'rgba(0, 122, 255, 0.12)'
                            }}
                          >
                            <ExternalLink size={14} color="#007AFF" />
                          </TouchableOpacity>
                        ) : null}
                      </XStack>
                    </XStack>
                  ))}
                </YStack>
              ) : (
                <YStack py="$3" alignItems="center">
                  <Text color="$colorPress" fontSize={13}>No parents or guardians linked yet.</Text>
                </YStack>
              )}
            </YStack>
          </Card>

          {/* Personal Information Card */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <Calendar size={18} color="#007AFF" />
                <Text color="$color" fontSize={16} fontWeight="700">Personal Details</Text>
              </XStack>
              <Separator borderColor="$borderColor" />

              <YStack space="$2">
                <XStack justifyContent="space-between">
                  <Text color="$colorPress" fontSize={12}>Date of Birth</Text>
                  <Text color="$color" fontSize={13} fontWeight="600">{formatDate(childData.dateOfBirth)}</Text>
                </XStack>

                {childData.phone ? (
                  <XStack justifyContent="space-between">
                    <Text color="$colorPress" fontSize={12}>Contact Phone</Text>
                    <Text color="$color" fontSize={13} fontWeight="600">{childData.phone}</Text>
                  </XStack>
                ) : null}

                {childData.email ? (
                  <XStack justifyContent="space-between">
                    <Text color="$colorPress" fontSize={12}>Email Address</Text>
                    <Text color="$color" fontSize={13} fontWeight="600">{childData.email}</Text>
                  </XStack>
                ) : null}

                <XStack justifyContent="space-between">
                  <Text color="$colorPress" fontSize={12}>Residence</Text>
                  <Text color="$color" fontSize={13} fontWeight="600">{childData.residenceLocation || 'Not recorded'}</Text>
                </XStack>

                {childData.digitalAddress ? (
                  <XStack justifyContent="space-between">
                    <Text color="$colorPress" fontSize={12}>Digital Address</Text>
                    <Text color="$color" fontSize={13} fontWeight="600">{childData.digitalAddress}</Text>
                  </XStack>
                ) : null}

                {childData.hometown ? (
                  <XStack justifyContent="space-between">
                    <Text color="$colorPress" fontSize={12}>Hometown</Text>
                    <Text color="$color" fontSize={13} fontWeight="600">{childData.hometown}</Text>
                  </XStack>
                ) : null}

                <XStack justifyContent="space-between">
                  <Text color="$colorPress" fontSize={12}>Enrolled Date</Text>
                  <Text color="$color" fontSize={13} fontWeight="600">{formatDate(childData.joinDate)}</Text>
                </XStack>

                {childData.notes ? (
                  <YStack marginTop="$2" p="$2.5" backgroundColor="rgba(0, 122, 255, 0.05)" borderRadius="$3">
                    <Text color="$colorPress" fontSize={11} fontWeight="700">NOTES</Text>
                    <Text color="$color" fontSize={12} marginTop="$1">{childData.notes}</Text>
                  </YStack>
                ) : null}
              </YStack>
            </YStack>
          </Card>

          {/* Attendance Statistics Card */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <CheckCircle size={18} color="#34C759" />
                <Text color="$color" fontSize={16} fontWeight="700">Attendance Statistics</Text>
              </XStack>
              <Separator borderColor="$borderColor" />

              <XStack space="$4" alignItems="center" py="$2">
                <YStack 
                  width={68} 
                  height={68} 
                  borderRadius={34} 
                  borderWidth={4} 
                  borderColor="#34C759" 
                  justifyContent="center" 
                  alignItems="center"
                  backgroundColor="rgba(52, 199, 89, 0.1)"
                >
                  <Text color="#34C759" fontWeight="800" fontSize={16}>{attendanceStats.percentage}%</Text>
                </YStack>

                <YStack flex={1}>
                  <Text color="$color" fontSize={14} fontWeight="700">Attendance Record</Text>
                  <Text color="$colorPress" fontSize={12} marginTop="$0.5">
                    Attended {attendanceStats.totalPresent} of {attendanceStats.totalServices} services recorded.
                  </Text>
                </YStack>
              </XStack>
            </YStack>
          </Card>

        </YStack>
      </ScrollView>
    </YStack>
  );
}
