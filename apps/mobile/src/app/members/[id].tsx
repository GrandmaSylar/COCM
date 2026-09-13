import React, { useEffect, useState } from 'react';
import { Image, Linking, TouchableOpacity, Alert, Modal, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  YStack, 
  XStack, 
  Text, 
  Card, 
  H2, 
  H3, 
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
  Church, 
  User, 
  ShieldCheck, 
  Edit3,
  Trash2,
  Users,
  CreditCard,
  FileText,
  ExternalLink,
  CheckCircle,
  X
} from '@tamagui/lucide-icons';
import { getLocalDb, LocalMember, upsertLocalMember, getMemberAttendanceHistory } from '../../lib/db';
import { getOrCacheProfilePhoto } from '../../lib/photoCache';
import { supabase } from '../../lib/supabase';
import { resolveMemberFamily, FamilyMember } from '../../lib/family';
import { api } from '../../lib/api';
import { AppHeader } from '../../components/AppHeader';


interface FullMemberData {
  id: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  gender?: 'male' | 'female' | string;
  maritalStatus?: string;
  dateOfBirth?: string;
  joinDate?: string;
  occupation?: string;
  hometown?: string;
  phone?: string;
  secondPhone?: string;
  email?: string;
  residenceLocation?: string;
  digitalAddress?: string;
  zone?: string;
  zoneNumber?: string;
  status?: string;
  photo?: string;
  notes?: string;
  baptismInfo?: {
    baptismStatus?: 'baptised' | 'not_baptised' | string;
    dateType?: 'full' | 'monthYear' | 'yearOnly' | 'forgotten' | string;
    fullDate?: string;
    month?: string;
    year?: string;
    previousCongregation?: string;
    roleInPreviousCongregation?: string;
  };
  ministries?: string[];
  positionHeld?: string[];
  legalInfo?: {
    ghanaCardNumber?: string;
    ghanaCardExpiryDate?: string;
    alternativeIdType?: string;
    alternativeIdNumber?: string;
  };
  familyMembers?: FamilyMember[];
}

export default function MemberProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [memberData, setMemberData] = useState<FullMemberData | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  const [attendanceStats, setAttendanceStats] = useState<{
    totalServices: number;
    presentCount: number;
    absentCount: number;
    percentage: number;
    history: any[];
  }>({
    totalServices: 0,
    presentCount: 0,
    absentCount: 0,
    percentage: 0,
    history: []
  });

  useEffect(() => {
    if (!id) return;

    // Load member attendance history from SQLite
    getMemberAttendanceHistory(id).then(stats => {
      setAttendanceStats({
        totalServices: stats.totalServices,
        presentCount: stats.presentCount,
        absentCount: stats.absentCount,
        percentage: stats.percentage,
        history: stats.history
      });
    }).catch(err => console.warn('Failed to load member attendance history:', err));

    const loadMemberDetails = async () => {
      try {
        const db = await getLocalDb();
        const row = await db.getFirstAsync<LocalMember>('SELECT * FROM members WHERE id = ?', [id]);
        
        let initialData: FullMemberData | null = null;

        if (row && row.raw_json) {
          try {
            initialData = JSON.parse(row.raw_json);
          } catch (e) {
            console.warn('Failed to parse cached member raw_json:', e);
          }
        }

        if (initialData) {
          setMemberData(initialData);
          setLoading(false);
          if (initialData.photo || row?.local_photo_path) {
            getOrCacheProfilePhoto(initialData.id, row?.local_photo_path || initialData.photo).then(setAvatarUri);
          }
        }

        // Fetch fresh server details and resolve bidirectional family tree
        try {
          let updatedData: FullMemberData | null = null;
          try {
            const apiRes = await api.members.getById(id);
            if (apiRes && apiRes.id) {
              updatedData = {
                id: apiRes.id,
                firstName: apiRes.firstName || '',
                lastName: apiRes.lastName || '',
                otherNames: apiRes.otherNames,
                gender: apiRes.gender || 'male',
                maritalStatus: apiRes.maritalStatus,
                dateOfBirth: apiRes.dateOfBirth || '1990-01-01',
                joinDate: apiRes.joinDate || apiRes.createdAt || new Date().toISOString(),
                occupation: apiRes.occupation,
                hometown: apiRes.hometown,
                phone: apiRes.phone,
                secondPhone: apiRes.secondPhone,
                email: apiRes.email,
                residenceLocation: apiRes.residenceLocation,
                digitalAddress: apiRes.digitalAddress,
                zone: apiRes.zone,
                zoneNumber: apiRes.zoneNumber,
                status: apiRes.status || 'active',
                photo: apiRes.photo || apiRes.photoUrl,
                notes: apiRes.notes,
                baptismInfo: apiRes.baptismInfo,
                ministries: Array.isArray(apiRes.ministries) ? apiRes.ministries : (apiRes.ministry ? [apiRes.ministry] : []),
                positionHeld: Array.isArray(apiRes.positionHeld) ? apiRes.positionHeld : (apiRes.role ? [apiRes.role] : []),
                legalInfo: apiRes.legalInfo,
                familyMembers: Array.isArray(apiRes.familyMembers) ? apiRes.familyMembers : []
              };
            }
          } catch (apiErr) {
            // Server fallback handled below
          }

          // Resolve full bidirectional family tree (direct, reciprocal inverse links, and linked children)
          const familyTree = await resolveMemberFamily(id);
          const currentBase = updatedData || initialData;
          if (currentBase) {
            if (familyTree && familyTree.length > 0) {
              currentBase.familyMembers = familyTree;
            }
            setMemberData({ ...currentBase });
            
            // Persist to local SQLite
            await upsertLocalMember({
              id: currentBase.id,
              name: `${currentBase.firstName} ${currentBase.lastName}`.trim(),
              phone: currentBase.phone,
              email: currentBase.email,
              role: currentBase.positionHeld?.[0] || 'Member',
              zone: currentBase.zone,
              ministry: currentBase.ministries?.[0],
              photo_url: currentBase.photo,
              status: currentBase.status || 'active',
              raw_json: JSON.stringify(currentBase),
              created_at: new Date().toISOString()
            });

            if (currentBase.photo) {
              const cachedPath = await getOrCacheProfilePhoto(currentBase.id, currentBase.photo);
              setAvatarUri(cachedPath);
            }
          }
        } catch (fetchErr) {
          console.warn('Error fetching fresh member details:', fetchErr);
        }
      } catch (err) {
        console.warn('Error loading member profile details:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMemberDetails();
  }, [id]);

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

  const formatBaptismDate = (info?: FullMemberData['baptismInfo']) => {
    if (!info || info.baptismStatus === 'not_baptised') return 'Not Baptised';
    if (info.dateType === 'full' && info.fullDate) return formatDate(info.fullDate);
    if (info.dateType === 'monthYear' && info.month && info.year) return `${info.month}/${info.year}`;
    if (info.dateType === 'yearOnly' && info.year) return info.year;
    return 'Baptised';
  };

  const handleCall = (phone?: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email?: string) => {
    if (email) Linking.openURL(`mailto:${email}`);
  };

  const handleDeleteMember = () => {
    if (!memberData) return;
    Alert.alert(
      'Delete Member',
      `Are you sure you want to delete ${memberData.firstName} ${memberData.lastName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getLocalDb();
              await db.runAsync('DELETE FROM members WHERE id = ?', [memberData.id]);
              await supabase.from('members').delete().eq('id', memberData.id);
              Alert.alert('Success', 'Member has been deleted');
              router.back();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete member');
            }
          }
        }
      ]
    );
  };

  const handleFamilyNavigate = (fm: FamilyMember) => {
    const targetId = fm.linkedMemberId || fm.childMemberId || fm.linkedChildMemberId;
    if (targetId) {
      router.push(`/members/${targetId}` as any);
    }
  };

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
        <Spinner size="large" color="#007AFF" />
        <Text color="$colorPress" marginTop="$2" fontSize={13}>Loading member profile...</Text>
      </YStack>
    );
  }

  if (!memberData) {
    return (
      <YStack flex={1} backgroundColor="$background">
        <AppHeader title="Member Details" showBack backTitle="Members" />
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
          <Text color="$color" fontSize={16} fontWeight="700">Member not found</Text>
          <Paragraph color="$colorPress" fontSize={13} textAlign="center" marginTop="$1">
            The requested member record could not be found or has been removed.
          </Paragraph>
          <Button marginTop="$4" backgroundColor="#007AFF" borderRadius="$3" onPress={() => router.back()}>
            <Text color="#FFFFFF" fontWeight="700">Go Back to Members</Text>
          </Button>
        </YStack>
      </YStack>
    );
  }

  const age = calculateAge(memberData.dateOfBirth);

  const parents = (memberData.familyMembers || []).filter(f => f.relationship === 'father' || f.relationship === 'mother');
  const siblings = (memberData.familyMembers || []).filter(f => f.relationship === 'sibling');
  const spouses = (memberData.familyMembers || []).filter(f => f.relationship === 'spouse');
  const children = (memberData.familyMembers || []).filter(f => f.relationship === 'child');

  return (
    <YStack flex={1} backgroundColor="$background">
      <AppHeader
        title={`${memberData.firstName} ${memberData.lastName}`}
        subtitle="Member Profile Details"
        showBack
        backTitle="Members"
        rightElement={
          <TouchableOpacity
            onPress={() => router.push(`/members/edit/${memberData.id}` as any)}
            style={{
              padding: 8,
              borderRadius: 8,
              backgroundColor: 'rgba(0, 122, 255, 0.12)',
            }}
          >
            <Edit3 size={18} color="#007AFF" />
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
            <TouchableOpacity onPress={() => avatarUri && setPhotoModalVisible(true)} activeOpacity={0.8}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 12, borderWidth: 3, borderColor: '#007AFF' }}
                />
              ) : (
                <YStack width={96} height={96} borderRadius={48} backgroundColor="rgba(0, 122, 255, 0.12)" justifyContent="center" alignItems="center" marginBottom="$3" borderWidth={3} borderColor="rgba(0, 122, 255, 0.3)">
                  <Text color="#007AFF" fontSize={32} fontWeight="800">
                    {memberData.firstName[0]}{memberData.lastName[0]}
                  </Text>
                </YStack>
              )}
            </TouchableOpacity>

            <H2 color="$color" fontWeight="800" fontSize={22} textAlign="center">
              {memberData.firstName} {memberData.otherNames ? `${memberData.otherNames} ` : ''}{memberData.lastName}
            </H2>

            <XStack space="$2" marginTop="$2" alignItems="center" flexWrap="wrap" justifyContent="center">
              <XStack backgroundColor="rgba(52, 199, 89, 0.15)" px="$2.5" py="$1" borderRadius="$3">
                <Text color="#34C759" fontSize={11} fontWeight="800">{memberData.status?.toUpperCase() || 'ACTIVE'}</Text>
              </XStack>
              {memberData.zone ? (
                <XStack backgroundColor="rgba(0, 122, 255, 0.12)" px="$2.5" py="$1" borderRadius="$3">
                  <Text color="#007AFF" fontSize={11} fontWeight="700">Zone {memberData.zone}</Text>
                </XStack>
              ) : null}
              {memberData.gender ? (
                <Text color="$colorPress" fontSize={12}>• {memberData.gender.toUpperCase()}</Text>
              ) : null}
              {age !== null ? (
                <Text color="$colorPress" fontSize={12}>• {age} yrs</Text>
              ) : null}
            </XStack>

            {/* Quick Action Dial / Email / Edit / Delete Row */}
            <XStack space="$2" marginTop="$4" flexWrap="wrap" justifyContent="center">
              {memberData.phone ? (
                <Button size="$3" backgroundColor="#34C759" borderRadius="$4" onPress={() => handleCall(memberData.phone)}>
                  <XStack space="$1.5" alignItems="center">
                    <Phone size={14} color="#FFFFFF" />
                    <Text color="#FFFFFF" fontWeight="700" fontSize={12}>Call</Text>
                  </XStack>
                </Button>
              ) : null}

              {memberData.email ? (
                <Button size="$3" backgroundColor="#007AFF" borderRadius="$4" onPress={() => handleEmail(memberData.email)}>
                  <XStack space="$1.5" alignItems="center">
                    <Mail size={14} color="#FFFFFF" />
                    <Text color="#FFFFFF" fontWeight="700" fontSize={12}>Email</Text>
                  </XStack>
                </Button>
              ) : null}

              <Button size="$3" backgroundColor="#FF9500" borderRadius="$4" onPress={() => router.push(`/members/edit/${memberData.id}` as any)}>
                <XStack space="$1.5" alignItems="center">
                  <Edit3 size={14} color="#FFFFFF" />
                  <Text color="#FFFFFF" fontWeight="700" fontSize={12}>Edit</Text>
                </XStack>
              </Button>

              <Button size="$3" backgroundColor="#FF3B30" borderRadius="$4" onPress={handleDeleteMember}>
                <XStack space="$1.5" alignItems="center">
                  <Trash2 size={14} color="#FFFFFF" />
                  <Text color="#FFFFFF" fontWeight="700" fontSize={12}>Delete</Text>
                </XStack>
              </Button>
            </XStack>
          </Card>

          {/* Personal Information Card */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <User size={18} color="#007AFF" />
                <Text color="$color" fontSize={16} fontWeight="700">Personal Information</Text>
              </XStack>
              <Separator borderColor="$borderColor" />

              <YStack space="$2">
                <XStack justifyContent="space-between">
                  <Text color="$colorPress" fontSize={12}>Full Name</Text>
                  <Text color="$color" fontSize={13} fontWeight="600">{memberData.firstName} {memberData.otherNames || ''} {memberData.lastName}</Text>
                </XStack>
                <XStack justifyContent="space-between">
                  <Text color="$colorPress" fontSize={12}>Gender</Text>
                  <Text color="$color" fontSize={13} fontWeight="600" textTransform="capitalize">{memberData.gender || 'N/A'}</Text>
                </XStack>
                {memberData.maritalStatus ? (
                  <XStack justifyContent="space-between">
                    <Text color="$colorPress" fontSize={12}>Marital Status</Text>
                    <Text color="$color" fontSize={13} fontWeight="600" textTransform="capitalize">{memberData.maritalStatus}</Text>
                  </XStack>
                ) : null}
                {age !== null ? (
                  <XStack justifyContent="space-between">
                    <Text color="$colorPress" fontSize={12}>Age</Text>
                    <Text color="$color" fontSize={13} fontWeight="600">{age} years old</Text>
                  </XStack>
                ) : null}
                {memberData.dateOfBirth ? (
                  <XStack justifyContent="space-between">
                    <Text color="$colorPress" fontSize={12}>Date of Birth</Text>
                    <Text color="$color" fontSize={13} fontWeight="600">{formatDate(memberData.dateOfBirth)}</Text>
                  </XStack>
                ) : null}
                {memberData.joinDate ? (
                  <XStack justifyContent="space-between">
                    <Text color="$colorPress" fontSize={12}>Join Date</Text>
                    <Text color="$color" fontSize={13} fontWeight="600">{formatDate(memberData.joinDate)}</Text>
                  </XStack>
                ) : null}
                {memberData.occupation ? (
                  <XStack justifyContent="space-between">
                    <Text color="$colorPress" fontSize={12}>Occupation</Text>
                    <Text color="$color" fontSize={13} fontWeight="600">{memberData.occupation}</Text>
                  </XStack>
                ) : null}
                {memberData.hometown ? (
                  <XStack justifyContent="space-between">
                    <Text color="$colorPress" fontSize={12}>Hometown</Text>
                    <Text color="$color" fontSize={13} fontWeight="600">{memberData.hometown}</Text>
                  </XStack>
                ) : null}
              </YStack>
            </YStack>
          </Card>

          {/* Contact Information Card */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <Phone size={18} color="#34C759" />
                <Text color="$color" fontSize={16} fontWeight="700">Contact Information</Text>
              </XStack>
              <Separator borderColor="$borderColor" />

              <XStack space="$3" alignItems="center">
                <YStack backgroundColor="rgba(52, 199, 89, 0.1)" p="$2" borderRadius="$3">
                  <Phone size={16} color="#34C759" />
                </YStack>
                <YStack flex={1}>
                  <Text color="$colorPress" fontSize={11}>Primary Phone</Text>
                  <Text color="$color" fontSize={14} fontWeight="600">{memberData.phone || 'Not specified'}</Text>
                </YStack>
              </XStack>

              {memberData.secondPhone ? (
                <XStack space="$3" alignItems="center">
                  <YStack backgroundColor="rgba(52, 199, 89, 0.1)" p="$2" borderRadius="$3">
                    <Phone size={16} color="#34C759" />
                  </YStack>
                  <YStack flex={1}>
                    <Text color="$colorPress" fontSize={11}>Secondary Phone</Text>
                    <Text color="$color" fontSize={14} fontWeight="600">{memberData.secondPhone}</Text>
                  </YStack>
                </XStack>
              ) : null}

              {memberData.email ? (
                <XStack space="$3" alignItems="center">
                  <YStack backgroundColor="rgba(0, 122, 255, 0.1)" p="$2" borderRadius="$3">
                    <Mail size={16} color="#007AFF" />
                  </YStack>
                  <YStack flex={1}>
                    <Text color="$colorPress" fontSize={11}>Email Address</Text>
                    <Text color="$color" fontSize={14} fontWeight="600">{memberData.email}</Text>
                  </YStack>
                </XStack>
              ) : null}
            </YStack>
          </Card>

          {/* Location Information Card */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <MapPin size={18} color="#FF9500" />
                <Text color="$color" fontSize={16} fontWeight="700">Location Information</Text>
              </XStack>
              <Separator borderColor="$borderColor" />

              <YStack space="$2">
                <XStack justifyContent="space-between">
                  <Text color="$colorPress" fontSize={12}>Residence</Text>
                  <Text color="$color" fontSize={13} fontWeight="600">{memberData.residenceLocation || 'Not recorded'}</Text>
                </XStack>
                {memberData.digitalAddress ? (
                  <XStack justifyContent="space-between">
                    <Text color="$colorPress" fontSize={12}>Digital Address</Text>
                    <Text color="$color" fontSize={13} fontWeight="600">{memberData.digitalAddress}</Text>
                  </XStack>
                ) : null}
                <XStack justifyContent="space-between">
                  <Text color="$colorPress" fontSize={12}>Zone</Text>
                  <Text color="$color" fontSize={13} fontWeight="600">Zone {memberData.zone || 'Unassigned'}</Text>
                </XStack>
              </YStack>
            </YStack>
          </Card>

          {/* Baptism Information Card */}
          {memberData.baptismInfo ? (
            <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
              <YStack space="$3">
                <XStack space="$2" alignItems="center">
                  <Church size={18} color="#5856D6" />
                  <Text color="$color" fontSize={16} fontWeight="700">Baptism Information</Text>
                </XStack>
                <Separator borderColor="$borderColor" />

                <YStack space="$2">
                  <XStack justifyContent="space-between">
                    <Text color="$colorPress" fontSize={12}>Baptism Status</Text>
                    <Text color="$color" fontSize={13} fontWeight="600">
                      {memberData.baptismInfo.baptismStatus === 'not_baptised' ? 'Not Baptised' : 'Baptised'}
                    </Text>
                  </XStack>

                  {memberData.baptismInfo.baptismStatus !== 'not_baptised' ? (
                    <XStack justifyContent="space-between">
                      <Text color="$colorPress" fontSize={12}>Baptism Date</Text>
                      <Text color="$color" fontSize={13} fontWeight="600">{formatBaptismDate(memberData.baptismInfo)}</Text>
                    </XStack>
                  ) : null}

                  {memberData.baptismInfo.previousCongregation ? (
                    <XStack justifyContent="space-between">
                      <Text color="$colorPress" fontSize={12}>Previous Congregation</Text>
                      <Text color="$color" fontSize={13} fontWeight="600">{memberData.baptismInfo.previousCongregation}</Text>
                    </XStack>
                  ) : null}

                  {memberData.baptismInfo.roleInPreviousCongregation ? (
                    <XStack justifyContent="space-between">
                      <Text color="$colorPress" fontSize={12}>Role in Previous Congregation</Text>
                      <Text color="$color" fontSize={13} fontWeight="600">{memberData.baptismInfo.roleInPreviousCongregation}</Text>
                    </XStack>
                  ) : null}
                </YStack>
              </YStack>
            </Card>
          ) : null}

          {/* Ministries and Positions Card */}
          {((memberData.ministries && memberData.ministries.length > 0) || (memberData.positionHeld && memberData.positionHeld.length > 0)) ? (
            <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
              <YStack space="$3">
                <XStack space="$2" alignItems="center">
                  <ShieldCheck size={18} color="#AF52DE" />
                  <Text color="$color" fontSize={16} fontWeight="700">Ministries & Positions</Text>
                </XStack>
                <Separator borderColor="$borderColor" />

                {memberData.ministries && memberData.ministries.length > 0 ? (
                  <YStack space="$1.5">
                    <Text color="$colorPress" fontSize={11} fontWeight="600">MINISTRIES</Text>
                    <XStack space="$2" flexWrap="wrap">
                      {memberData.ministries.map((m, idx) => (
                        <XStack key={idx} backgroundColor="rgba(0, 122, 255, 0.12)" px="$3" py="$1" borderRadius="$3" marginBottom="$1">
                          <Text color="#007AFF" fontSize={12} fontWeight="700">{m}</Text>
                        </XStack>
                      ))}
                    </XStack>
                  </YStack>
                ) : null}

                {memberData.positionHeld && memberData.positionHeld.length > 0 ? (
                  <YStack space="$1.5" marginTop="$2">
                    <Text color="$colorPress" fontSize={11} fontWeight="600">POSITIONS HELD</Text>
                    <XStack space="$2" flexWrap="wrap">
                      {memberData.positionHeld.map((p, idx) => (
                        <XStack key={idx} backgroundColor="rgba(175, 82, 222, 0.12)" px="$3" py="$1" borderRadius="$3" marginBottom="$1">
                          <Text color="#AF52DE" fontSize={12} fontWeight="700">{p}</Text>
                        </XStack>
                      ))}
                    </XStack>
                  </YStack>
                ) : null}
              </YStack>
            </Card>
          ) : null}

          {/* Family Tree & Linkages Card */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <Users size={18} color="#007AFF" />
                <Text color="$color" fontSize={16} fontWeight="700">Family Tree & Details</Text>
              </XStack>
              <Separator borderColor="$borderColor" />

              {/* VISUAL FAMILY TREE GRAPH */}
              {(parents.length > 0 || siblings.length > 0 || spouses.length > 0 || children.length > 0) ? (
                <YStack py="$3" px="$2" backgroundColor="rgba(0, 122, 255, 0.03)" borderRadius="$4" borderWidth={1} borderColor="rgba(0, 122, 255, 0.1)" marginBottom="$3" alignItems="center">
                  {/* Parents Row */}
                  {parents.length > 0 && (
                    <XStack space="$4" justifyContent="center" marginBottom="$2" flexWrap="wrap">
                      {parents.map((p) => {
                        const isClickable = p.isLinked && (p.linkedMemberId || p.childMemberId);
                        return (
                          <TouchableOpacity 
                            key={p.id} 
                            disabled={!isClickable}
                            onPress={() => isClickable && handleFamilyNavigate(p)}
                            activeOpacity={0.7}
                          >
                            <YStack alignItems="center">
                              <YStack 
                                width={50} 
                                height={50} 
                                borderRadius={25} 
                                backgroundColor={p.relationship === 'father' ? 'rgba(0, 122, 255, 0.15)' : 'rgba(255, 45, 85, 0.15)'} 
                                justifyContent="center" 
                                alignItems="center" 
                                borderWidth={p.isLinked ? 2.5 : 0} 
                                borderColor={p.relationship === 'father' ? '#007AFF' : '#FF2D55'}
                                overflow="hidden"
                              >
                                {p.photo ? (
                                  <Image source={{ uri: p.photo }} style={{ width: 46, height: 46, borderRadius: 23 }} />
                                ) : (
                                  <Text color={p.relationship === 'father' ? '#007AFF' : '#FF2D55'} fontWeight="800" fontSize={15}>
                                    {p.firstName[0]}{p.lastName[0]}
                                  </Text>
                                )}
                              </YStack>
                              <Text color="$color" fontSize={11} fontWeight="700" marginTop="$1">{p.firstName} {p.lastName}</Text>
                              <Text color="$colorPress" fontSize={10} textTransform="capitalize">{p.relationship}</Text>
                              {isClickable ? (
                                <XStack backgroundColor="rgba(0, 122, 255, 0.12)" px="$1.5" py="$0.5" borderRadius="$2" marginTop="$0.5">
                                  <Text color="#007AFF" fontSize={8} fontWeight="700">View Profile</Text>
                                </XStack>
                              ) : null}
                            </YStack>
                          </TouchableOpacity>
                        );
                      })}
                    </XStack>
                  )}

                  {parents.length > 0 && (
                    <YStack width={2} height={16} backgroundColor="$borderColor" marginBottom="$2" />
                  )}

                  {/* Member & Spouse & Siblings Row */}
                  <XStack space="$3" alignItems="center" justifyContent="center" marginBottom="$2" flexWrap="wrap">
                    {siblings.map((sib) => {
                      const isClickable = sib.isLinked && (sib.linkedMemberId || sib.childMemberId);
                      return (
                        <TouchableOpacity 
                          key={sib.id} 
                          disabled={!isClickable}
                          onPress={() => isClickable && handleFamilyNavigate(sib)}
                          activeOpacity={0.7}
                        >
                          <YStack alignItems="center">
                            <YStack 
                              width={44} 
                              height={44} 
                              borderRadius={22} 
                              backgroundColor="rgba(142, 142, 147, 0.15)" 
                              justifyContent="center" 
                              alignItems="center" 
                              borderWidth={sib.isLinked ? 2 : 0} 
                              borderColor="#007AFF"
                              overflow="hidden"
                            >
                              {sib.photo ? (
                                <Image source={{ uri: sib.photo }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                              ) : (
                                <Text color="$color" fontWeight="700" fontSize={13}>{sib.firstName[0]}{sib.lastName[0]}</Text>
                              )}
                            </YStack>
                            <Text color="$color" fontSize={10} fontWeight="600" marginTop="$1">{sib.firstName}</Text>
                            <Text color="$colorPress" fontSize={9}>Sibling</Text>
                            {isClickable ? (
                              <XStack backgroundColor="rgba(0, 122, 255, 0.12)" px="$1.5" py="$0.5" borderRadius="$2" marginTop="$0.5">
                                <Text color="#007AFF" fontSize={8} fontWeight="700">View Profile</Text>
                              </XStack>
                            ) : null}
                          </YStack>
                        </TouchableOpacity>
                      );
                    })}

                    {siblings.length > 0 && (
                      <YStack width={12} height={2} backgroundColor="$borderColor" />
                    )}

                    {/* Center Node: The Member */}
                    <YStack alignItems="center" px="$2">
                      <YStack 
                        width={62} 
                        height={62} 
                        borderRadius={31} 
                        backgroundColor="rgba(0, 122, 255, 0.15)" 
                        justifyContent="center" 
                        alignItems="center" 
                        borderWidth={3.5} 
                        borderColor="#007AFF"
                        overflow="hidden"
                      >
                        {avatarUri || memberData.photo ? (
                          <Image source={{ uri: avatarUri || memberData.photo }} style={{ width: 55, height: 55, borderRadius: 27.5 }} />
                        ) : (
                          <Text color="#007AFF" fontWeight="800" fontSize={18}>{memberData.firstName[0]}{memberData.lastName[0]}</Text>
                        )}
                      </YStack>
                      <Text color="$color" fontSize={12} fontWeight="800" marginTop="$1">{memberData.firstName}</Text>
                      <XStack backgroundColor="#007AFF" px="$2" py="$0.5" borderRadius="$2" marginTop="$0.5">
                        <Text color="#FFFFFF" fontSize={9} fontWeight="800">This Member</Text>
                      </XStack>
                    </YStack>

                    {/* Spouse Node */}
                    {spouses.map((sp) => {
                      const isClickable = sp.isLinked && (sp.linkedMemberId || sp.childMemberId);
                      return (
                        <React.Fragment key={sp.id}>
                          <XStack space="$1" alignItems="center">
                            <YStack width={10} height={2} backgroundColor="#FF3B30" />
                            <Text color="#FF3B30" fontSize={9} fontWeight="700">married</Text>
                            <YStack width={10} height={2} backgroundColor="#FF3B30" />
                          </XStack>
                          <TouchableOpacity 
                            disabled={!isClickable}
                            onPress={() => isClickable && handleFamilyNavigate(sp)}
                            activeOpacity={0.7}
                          >
                            <YStack alignItems="center">
                              <YStack 
                                width={50} 
                                height={50} 
                                borderRadius={25} 
                                backgroundColor="rgba(255, 149, 0, 0.15)" 
                                justifyContent="center" 
                                alignItems="center" 
                                borderWidth={sp.isLinked ? 2.5 : 0} 
                                borderColor="#FF9500"
                                overflow="hidden"
                              >
                                {sp.photo ? (
                                  <Image source={{ uri: sp.photo }} style={{ width: 46, height: 46, borderRadius: 23 }} />
                                ) : (
                                  <Text color="#FF9500" fontWeight="800" fontSize={14}>{sp.firstName[0]}{sp.lastName[0]}</Text>
                                )}
                              </YStack>
                              <Text color="$color" fontSize={11} fontWeight="700" marginTop="$1">{sp.firstName} {sp.lastName}</Text>
                              <Text color="$colorPress" fontSize={10}>Spouse</Text>
                              {isClickable ? (
                                <XStack backgroundColor="rgba(255, 149, 0, 0.15)" px="$1.5" py="$0.5" borderRadius="$2" marginTop="$0.5">
                                  <Text color="#FF9500" fontSize={8} fontWeight="700">View Profile</Text>
                                </XStack>
                              ) : null}
                            </YStack>
                          </TouchableOpacity>
                        </React.Fragment>
                      );
                    })}
                  </XStack>

                  {children.length > 0 && (
                    <YStack width={2} height={16} backgroundColor="$borderColor" marginBottom="$2" />
                  )}

                  {/* Children Row */}
                  {children.length > 0 && (
                    <XStack space="$3" justifyContent="center" flexWrap="wrap">
                      {children.map((ch) => {
                        const isClickable = ch.isLinked && (ch.linkedMemberId || ch.childMemberId || ch.linkedChildMemberId);
                        return (
                          <TouchableOpacity 
                            key={ch.id} 
                            disabled={!isClickable}
                            onPress={() => isClickable && handleFamilyNavigate(ch)}
                            activeOpacity={0.7}
                          >
                            <YStack alignItems="center">
                              <YStack 
                                width={44} 
                                height={44} 
                                borderRadius={22} 
                                backgroundColor="rgba(52, 199, 89, 0.15)" 
                                justifyContent="center" 
                                alignItems="center" 
                                borderWidth={ch.isLinked ? 2 : 0} 
                                borderColor="#34C759"
                                overflow="hidden"
                              >
                                {ch.photo ? (
                                  <Image source={{ uri: ch.photo }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                                ) : (
                                  <Text color="#34C759" fontWeight="800" fontSize={13}>{ch.firstName[0]}{ch.lastName[0]}</Text>
                                )}
                              </YStack>
                              <Text color="$color" fontSize={10} fontWeight="700" marginTop="$1">{ch.firstName}</Text>
                              <Text color="$colorPress" fontSize={9}>Child</Text>
                              {isClickable ? (
                                <XStack backgroundColor="rgba(52, 199, 89, 0.15)" px="$1.5" py="$0.5" borderRadius="$2" marginTop="$0.5">
                                  <Text color="#34C759" fontSize={8} fontWeight="700">View Profile</Text>
                                </XStack>
                              ) : null}
                            </YStack>
                          </TouchableOpacity>
                        );
                      })}
                    </XStack>
                  )}
                </YStack>
              ) : (
                <YStack py="$4" px="$3" alignItems="center" backgroundColor="rgba(142, 142, 147, 0.05)" borderRadius="$4" borderWidth={1} borderColor="$borderColor" marginBottom="$3">
                  <YStack width={48} height={48} borderRadius={24} backgroundColor="rgba(0, 122, 255, 0.1)" justifyContent="center" alignItems="center" marginBottom="$2">
                    <Users size={24} color="#007AFF" />
                  </YStack>
                  <Text color="$color" fontSize={14} fontWeight="700">No Family Members Linked</Text>
                  <Paragraph color="$colorPress" fontSize={12} textAlign="center" marginTop="$1" maxWidth={260}>
                    No relatives (parents, spouse, siblings, or children) have been linked to this member profile yet.
                  </Paragraph>
                  <TouchableOpacity 
                    onPress={() => router.push(`/members/edit/${memberData.id}` as any)}
                    style={{ marginTop: 12, backgroundColor: '#007AFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                  >
                    <Text color="#FFFFFF" fontSize={12} fontWeight="700">Link Family Members</Text>
                  </TouchableOpacity>
                </YStack>
              )}

              {/* Detailed Family Members List */}
              {memberData.familyMembers && memberData.familyMembers.length > 0 ? (
                <YStack space="$2">
                  <Text color="$color" fontSize={13} fontWeight="700" marginBottom="$1">Family Details</Text>
                  {memberData.familyMembers.map((fm) => {
                    const isClickable = fm.isLinked && (fm.linkedMemberId || fm.childMemberId || fm.linkedChildMemberId);
                    return (
                      <TouchableOpacity 
                        key={fm.id} 
                        disabled={!isClickable}
                        onPress={() => isClickable && handleFamilyNavigate(fm)}
                        activeOpacity={0.7}
                      >
                        <XStack 
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
                              <Text color="$color" fontSize={14} fontWeight="700">{fm.firstName} {fm.lastName}</Text>
                              {fm.isLinked ? (
                                <XStack backgroundColor="rgba(52, 199, 89, 0.15)" px="$2" py="$0.5" borderRadius="$2">
                                  <Text color="#34C759" fontSize={10} fontWeight="800">Church Member</Text>
                                </XStack>
                              ) : null}
                            </XStack>
                            <Text color="$colorPress" fontSize={12} textTransform="capitalize" marginTop="$1">
                              {fm.relationship} {fm.phone ? `• ${fm.phone}` : ''}
                            </Text>
                          </YStack>

                          <XStack space="$2" alignItems="center">
                            {fm.phone ? (
                              <TouchableOpacity
                                onPress={() => handleCall(fm.phone)}
                                style={{
                                  padding: 7,
                                  borderRadius: 16,
                                  backgroundColor: 'rgba(52, 199, 89, 0.12)'
                                }}
                              >
                                <Phone size={13} color="#34C759" />
                              </TouchableOpacity>
                            ) : null}
                            {isClickable ? (
                              <ExternalLink size={16} color="#007AFF" />
                            ) : null}
                          </XStack>
                        </XStack>
                      </TouchableOpacity>
                    );
                  })}
                </YStack>
              ) : null}
            </YStack>
          </Card>

          {/* Legal Information Card */}
          {memberData.legalInfo && (memberData.legalInfo.ghanaCardNumber || memberData.legalInfo.alternativeIdNumber) ? (
            <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
              <YStack space="$3">
                <XStack space="$2" alignItems="center">
                  <CreditCard size={18} color="#FF2D55" />
                  <Text color="$color" fontSize={16} fontWeight="700">Legal Information</Text>
                </XStack>
                <Separator borderColor="$borderColor" />

                <YStack space="$2">
                  {memberData.legalInfo.ghanaCardNumber ? (
                    <XStack justifyContent="space-between">
                      <Text color="$colorPress" fontSize={12}>Ghana Card Number</Text>
                      <Text color="$color" fontSize={13} fontWeight="600">{memberData.legalInfo.ghanaCardNumber}</Text>
                    </XStack>
                  ) : null}
                  {memberData.legalInfo.ghanaCardExpiryDate ? (
                    <XStack justifyContent="space-between">
                      <Text color="$colorPress" fontSize={12}>Ghana Card Expiry</Text>
                      <Text color="$color" fontSize={13} fontWeight="600">{formatDate(memberData.legalInfo.ghanaCardExpiryDate)}</Text>
                    </XStack>
                  ) : null}
                  {memberData.legalInfo.alternativeIdNumber ? (
                    <XStack justifyContent="space-between">
                      <Text color="$colorPress" fontSize={12}>Alternative ID ({memberData.legalInfo.alternativeIdType || 'Other'})</Text>
                      <Text color="$color" fontSize={13} fontWeight="600">{memberData.legalInfo.alternativeIdNumber}</Text>
                    </XStack>
                  ) : null}
                </YStack>
              </YStack>
            </Card>
          ) : null}

          {/* Notes Card */}
          {memberData.notes ? (
            <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
              <YStack space="$2">
                <XStack space="$2" alignItems="center">
                  <FileText size={18} color="#5AC8FA" />
                  <Text color="$color" fontSize={16} fontWeight="700">Notes</Text>
                </XStack>
                <Separator borderColor="$borderColor" />
                <Paragraph color="$colorPress" fontSize={13}>{memberData.notes}</Paragraph>
              </YStack>
            </Card>
          ) : null}

          {/* Attendance Stats Card */}
          <Card padding="$4" borderRadius="$5" backgroundColor="$cardBackground" borderColor="$borderColor" borderWidth={1} elevate>
            <YStack space="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <XStack space="$2" alignItems="center">
                  <Calendar size={18} color="#007AFF" />
                  <Text color="$color" fontSize={16} fontWeight="700">Attendance Statistics</Text>
                </XStack>
                <TouchableOpacity onPress={() => router.push('/attendance' as any)}>
                  <Text color="#007AFF" fontSize={12} fontWeight="700">Attendance Module →</Text>
                </TouchableOpacity>
              </XStack>

              <Separator borderColor="$borderColor" />

              <XStack alignItems="center" space="$4">
                <YStack width={64} height={64} borderRadius={32} backgroundColor="rgba(52, 199, 89, 0.15)" justifyContent="center" alignItems="center" borderWidth={3} borderColor="#34C759">
                  <Text color="#34C759" fontSize={16} fontWeight="800">{attendanceStats.percentage}%</Text>
                </YStack>

                <YStack flex={1} space="$1">
                  <Text color="$color" fontSize={14} fontWeight="700">Individual Record</Text>
                  <Text color="$colorPress" fontSize={12}>
                    Attended {attendanceStats.presentCount} of {attendanceStats.totalServices} service sessions
                  </Text>
                </YStack>
              </XStack>

              {attendanceStats.history && attendanceStats.history.length > 0 && (
                <YStack space="$1.5" marginTop="$2">
                  <Text color="$colorPress" fontSize={11} fontWeight="700" textTransform="uppercase">Recent Individual Service Logs</Text>
                  {attendanceStats.history.slice(0, 4).map((item: any) => (
                    <XStack key={item.id} p="$2.5" borderRadius="$3" backgroundColor="$background" borderWidth={1} borderColor="$borderColor" justifyContent="space-between" alignItems="center">
                      <YStack>
                        <Text color="$color" fontSize={13} fontWeight="700">{item.serviceType}</Text>
                        <Text color="$colorPress" fontSize={11}>{item.date}</Text>
                      </YStack>
                      <XStack backgroundColor={item.isPresent ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)'} px="$2" py="$0.5" borderRadius="$2">
                        <Text color={item.isPresent ? '#34C759' : '#FF3B30'} fontSize={10} fontWeight="800">
                          {item.isPresent ? 'PRESENT' : 'ABSENT'}
                        </Text>
                      </XStack>
                    </XStack>
                  ))}
                </YStack>
              )}
            </YStack>
          </Card>

        </YStack>
      </ScrollView>

      {/* Profile Photo Full Size Modal */}
      <Modal visible={photoModalVisible} transparent animationType="fade" onRequestClose={() => setPhotoModalVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setPhotoModalVisible(false)}>
          <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }} onPress={() => setPhotoModalVisible(false)}>
            <X size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={{ width: Dimensions.get('window').width * 0.9, height: Dimensions.get('window').width * 0.9, borderRadius: 16 }}
              resizeMode="contain"
            />
          ) : null}
        </TouchableOpacity>
      </Modal>
    </YStack>
  );
}
