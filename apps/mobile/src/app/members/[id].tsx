import React, { useEffect, useState } from 'react';
import { Image, Linking, Alert, Modal, Dimensions, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Phone, Mail, Edit3, Trash2, Users, UserX, X } from '@tamagui/lucide-icons';
import { getLocalDb, LocalMember, upsertLocalMember, getMemberAttendanceHistory } from '../../lib/db';
import { getOrCacheProfilePhoto } from '../../lib/photoCache';
import { supabase } from '../../lib/supabase';
import { resolveMemberFamily, FamilyMember } from '../../lib/family';
import { api } from '../../lib/api';
import { useAppColors } from '../../context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import { SkeletonProfile } from '../../components/Skeleton';
import {
  AppText, Avatar, Badge, Button, DetailRow, EmptyState, IconButton, ListRow, QuickAction, Screen, Section, Surface, useToast,
} from '../../components/ui';
import { enterUp } from '../../theme/animations';
import { memberStatusTone, statusLabel } from '../../theme/status';
import { radius, space } from '../../theme/tokens';


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
  const toast = useToast();
  const c = useAppColors();

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
              zone_number: currentBase.zoneNumber,
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
      'Delete member?',
      `${memberData.firstName} ${memberData.lastName} will be permanently removed. This can’t be undone.`,
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
              toast.show({ title: 'Member deleted', message: `${memberData.firstName} ${memberData.lastName}` });
              router.back();
            } catch (err) {
              toast.show({ title: 'Couldn’t delete member', tone: 'error' });
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
      <Screen>
        <AppHeader title="Member" showBack />
        <SkeletonProfile />
      </Screen>
    );
  }

  if (!memberData) {
    return (
      <Screen>
        <AppHeader title="Member" showBack />
        <EmptyState
          icon={UserX}
          title="Member not found"
          message="This member record couldn’t be found or has been removed."
          action={{ label: 'Back to members', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const age = calculateAge(memberData.dateOfBirth);

  const parents = (memberData.familyMembers || []).filter(f => f.relationship === 'father' || f.relationship === 'mother');
  const siblings = (memberData.familyMembers || []).filter(f => f.relationship === 'sibling');
  const spouses = (memberData.familyMembers || []).filter(f => f.relationship === 'spouse');
  const children = (memberData.familyMembers || []).filter(f => f.relationship === 'child');
  const hasFamily = parents.length + siblings.length + spouses.length + children.length > 0;

  const fullName = `${memberData.firstName} ${memberData.otherNames ? `${memberData.otherNames} ` : ''}${memberData.lastName}`;
  const zoneText = memberData.zone ? `Zone ${memberData.zone}${memberData.zoneNumber ? ` · ${memberData.zoneNumber}` : ''}` : null;
  const metaLine = [
    memberData.gender ? memberData.gender.charAt(0).toUpperCase() + memberData.gender.slice(1) : null,
    age !== null ? `${age} yrs` : null,
  ].filter(Boolean).join(' · ');

  const isClickable = (fm: FamilyMember) => !!(fm.isLinked && (fm.linkedMemberId || fm.childMemberId || fm.linkedChildMemberId));

  const FamilyNode = ({ fm, label, size = 48 }: { fm: FamilyMember; label: string; size?: number }) => {
    const clickable = isClickable(fm);
    return (
      <Pressable
        disabled={!clickable}
        onPress={() => clickable && handleFamilyNavigate(fm)}
        accessibilityRole={clickable ? 'button' : undefined}
        accessibilityLabel={`${fm.firstName} ${fm.lastName}, ${label}${clickable ? ', view profile' : ''}`}
        style={{ alignItems: 'center', width: 84, gap: 4 }}
      >
        <View style={{ padding: 2, borderRadius: Math.round(size * 0.36), borderWidth: 2, borderColor: clickable ? c.primary.base : 'transparent' }}>
          <Avatar name={`${fm.firstName} ${fm.lastName}`} uri={fm.photo} size={size} />
        </View>
        <AppText variant="captionStrong" align="center" numberOfLines={1}>{fm.firstName}</AppText>
        <AppText variant="micro" tone={clickable ? 'primary' : 'subtle'} align="center">{label}</AppText>
      </Pressable>
    );
  };

  const connector = (h = 16) => <View style={{ width: 2, height: h, backgroundColor: c.borderStrong, alignSelf: 'center' }} />;

  return (
    <Screen>
      <AppHeader
        title={`${memberData.firstName} ${memberData.lastName}`}
        subtitle="Member profile"
        showBack
        rightElement={
          <IconButton icon={Edit3} label="Edit member" tone="primary" onPress={() => router.push(`/members/edit/${memberData.id}` as any)} />
        }
      />

      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xl }}>
        {/* Hero */}
        <Animated.View entering={enterUp()} style={{ alignItems: 'center', gap: space.sm, paddingTop: space.xs }}>
          <Pressable
            onPress={() => avatarUri && setPhotoModalVisible(true)}
            disabled={!avatarUri}
            accessibilityRole={avatarUri ? 'imagebutton' : undefined}
            accessibilityLabel={avatarUri ? 'View photo' : undefined}
          >
            <Avatar name={`${memberData.firstName} ${memberData.lastName}`} uri={avatarUri} size={96} />
          </Pressable>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <AppText variant="title" align="center" selectable>{fullName}</AppText>
            {metaLine ? <AppText variant="caption" tone="muted">{metaLine}</AppText> : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            <Badge label={statusLabel(memberData.status)} tone={memberStatusTone(memberData.status)} />
            {zoneText ? <Badge label={zoneText} tone="neutral" /> : null}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg, marginTop: space.sm }}>
            {memberData.phone ? <QuickAction icon={Phone} label="Call" onPress={() => handleCall(memberData.phone)} /> : null}
            {memberData.email ? <QuickAction icon={Mail} label="Email" onPress={() => handleEmail(memberData.email)} /> : null}
            <QuickAction icon={Edit3} label="Edit" onPress={() => router.push(`/members/edit/${memberData.id}` as any)} />
            <QuickAction icon={Trash2} label="Delete" tone="danger" onPress={handleDeleteMember} />
          </View>
        </Animated.View>

        {/* Attendance */}
        <Animated.View entering={enterUp(40)}>
          <Section
            title="Attendance"
            action={<Button label="Attendance" variant="ghost" size="sm" onPress={() => router.push('/attendance' as any)} />}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.success.soft, alignItems: 'center', justifyContent: 'center' }}>
                <AppText variant="headline" tone="success" numeric>{attendanceStats.percentage}%</AppText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">Attended {attendanceStats.presentCount} of {attendanceStats.totalServices}</AppText>
                <AppText variant="caption" tone="muted">Recorded service sessions</AppText>
              </View>
            </View>
            {(attendanceStats.history || []).slice(0, 4).map((item: any) => (
              <ListRow
                key={item.id}
                title={item.serviceType}
                subtitle={item.date}
                right={<Badge label={item.isPresent ? 'Present' : 'Absent'} tone={item.isPresent ? 'success' : 'danger'} />}
              />
            ))}
          </Section>
        </Animated.View>

        {/* Personal */}
        <Animated.View entering={enterUp(80)} style={{ gap: space.xl }}>
          <Section title="Personal">
            <DetailRow label="Full name" value={fullName} />
            <DetailRow label="Gender" value={memberData.gender ? memberData.gender.charAt(0).toUpperCase() + memberData.gender.slice(1) : undefined} fallback="N/A" />
            {memberData.maritalStatus ? <DetailRow label="Marital status" value={memberData.maritalStatus.charAt(0).toUpperCase() + memberData.maritalStatus.slice(1)} /> : null}
            {memberData.dateOfBirth ? <DetailRow label="Date of birth" value={`${formatDate(memberData.dateOfBirth)}${age !== null ? ` (${age})` : ''}`} /> : null}
            {memberData.joinDate ? <DetailRow label="Joined" value={formatDate(memberData.joinDate)} /> : null}
            {memberData.occupation ? <DetailRow label="Occupation" value={memberData.occupation} /> : null}
            {memberData.hometown ? <DetailRow label="Hometown" value={memberData.hometown} /> : null}
          </Section>

          <Section title="Contact">
            <DetailRow label="Primary phone" value={memberData.phone} fallback="Not specified" onPress={() => handleCall(memberData.phone)} />
            {memberData.secondPhone ? <DetailRow label="Second phone" value={memberData.secondPhone} onPress={() => handleCall(memberData.secondPhone)} /> : null}
            {memberData.email ? <DetailRow label="Email" value={memberData.email} onPress={() => handleEmail(memberData.email)} /> : null}
          </Section>

          <Section title="Location">
            <DetailRow label="Residence" value={memberData.residenceLocation} />
            {memberData.digitalAddress ? <DetailRow label="Digital address" value={memberData.digitalAddress} /> : null}
            <DetailRow label="Zone" value={memberData.zone ? `Zone ${memberData.zone}` : undefined} fallback="Unassigned" />
            {memberData.zoneNumber ? <DetailRow label="Zone number" value={memberData.zoneNumber} valueTone="primary" /> : null}
          </Section>

          {memberData.baptismInfo ? (
            <Section title="Baptism">
              <DetailRow label="Status" value={memberData.baptismInfo.baptismStatus === 'not_baptised' ? 'Not baptised' : 'Baptised'} />
              {memberData.baptismInfo.baptismStatus !== 'not_baptised' ? (
                <DetailRow label="Date" value={formatBaptismDate(memberData.baptismInfo)} />
              ) : null}
              {memberData.baptismInfo.previousCongregation ? <DetailRow label="Previous congregation" value={memberData.baptismInfo.previousCongregation} /> : null}
              {memberData.baptismInfo.roleInPreviousCongregation ? <DetailRow label="Role there" value={memberData.baptismInfo.roleInPreviousCongregation} /> : null}
            </Section>
          ) : null}

          {(memberData.ministries?.length || memberData.positionHeld?.length) ? (
            <Section title="Ministries & positions" bare>
              <Surface style={{ gap: space.md }}>
                {memberData.ministries?.length ? (
                  <View style={{ gap: space.xs }}>
                    <AppText variant="caption" tone="muted">Ministries</AppText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {memberData.ministries.map((m, idx) => <Badge key={idx} label={m} tone="primary" />)}
                    </View>
                  </View>
                ) : null}
                {memberData.positionHeld?.length ? (
                  <View style={{ gap: space.xs }}>
                    <AppText variant="caption" tone="muted">Positions held</AppText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {memberData.positionHeld.map((p, idx) => <Badge key={idx} label={p} tone="neutral" />)}
                    </View>
                  </View>
                ) : null}
              </Surface>
            </Section>
          ) : null}

          {/* Family */}
          <Section title="Family" bare>
            {hasFamily ? (
              <Surface style={{ gap: space.xs, alignItems: 'center' }}>
                {parents.length > 0 ? (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                      {parents.map(p => <FamilyNode key={p.id} fm={p} label={p.relationship === 'father' ? 'Father' : 'Mother'} />)}
                    </View>
                    {connector()}
                  </>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, flexWrap: 'wrap' }}>
                  {siblings.map(sib => <FamilyNode key={sib.id} fm={sib} label="Sibling" size={42} />)}
                  <View style={{ alignItems: 'center', width: 92, gap: 4 }}>
                    <View style={{ padding: 2, borderRadius: 24, borderWidth: 2, borderColor: c.primary.base }}>
                      <Avatar name={`${memberData.firstName} ${memberData.lastName}`} uri={avatarUri || memberData.photo} size={58} />
                    </View>
                    <AppText variant="captionStrong" align="center" numberOfLines={1}>{memberData.firstName}</AppText>
                    <Badge label="This member" tone="primary" />
                  </View>
                  {spouses.map(sp => (
                    <React.Fragment key={sp.id}>
                      <AppText variant="micro" tone="subtle">married</AppText>
                      <FamilyNode fm={sp} label="Spouse" />
                    </React.Fragment>
                  ))}
                </View>

                {children.length > 0 ? (
                  <>
                    {connector()}
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                      {children.map(ch => <FamilyNode key={ch.id} fm={ch} label="Child" size={42} />)}
                    </View>
                  </>
                ) : null}
              </Surface>
            ) : (
              <Surface>
                <EmptyState
                  icon={Users}
                  title="No family linked"
                  message="Link parents, a spouse, siblings or children to see the family tree."
                  action={{ label: 'Link family members', onPress: () => router.push(`/members/edit/${memberData.id}` as any) }}
                />
              </Surface>
            )}

            {memberData.familyMembers && memberData.familyMembers.length > 0 ? (
              <Surface padded={false}>
                {memberData.familyMembers.map((fm, i) => {
                  const clickable = isClickable(fm);
                  return (
                    <View key={fm.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                      <ListRow
                        title={`${fm.firstName} ${fm.lastName}`}
                        subtitle={`${fm.relationship.charAt(0).toUpperCase() + fm.relationship.slice(1)}${fm.phone ? ` · ${fm.phone}` : ''}`}
                        onPress={clickable ? () => handleFamilyNavigate(fm) : undefined}
                        right={
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {fm.isLinked ? <Badge label="Member" tone="success" /> : null}
                            {fm.phone ? <IconButton icon={Phone} label={`Call ${fm.firstName}`} tone="primary" size={36} onPress={() => handleCall(fm.phone)} /> : null}
                          </View>
                        }
                        chevron={clickable}
                      />
                    </View>
                  );
                })}
              </Surface>
            ) : null}
          </Section>

          {memberData.legalInfo && (memberData.legalInfo.ghanaCardNumber || memberData.legalInfo.alternativeIdNumber) ? (
            <Section title="Identification">
              {memberData.legalInfo.ghanaCardNumber ? <DetailRow label="Ghana Card" value={memberData.legalInfo.ghanaCardNumber} /> : null}
              {memberData.legalInfo.ghanaCardExpiryDate ? <DetailRow label="Ghana Card expiry" value={formatDate(memberData.legalInfo.ghanaCardExpiryDate)} /> : null}
              {memberData.legalInfo.alternativeIdNumber ? (
                <DetailRow label={`Other ID (${memberData.legalInfo.alternativeIdType || 'Other'})`} value={memberData.legalInfo.alternativeIdNumber} />
              ) : null}
            </Section>
          ) : null}

          {memberData.notes ? (
            <Section title="Notes" bare>
              <Surface>
                <AppText variant="body" tone="muted" selectable>{memberData.notes}</AppText>
              </Surface>
            </Section>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Full-size photo */}
      <Modal visible={photoModalVisible} transparent animationType="fade" onRequestClose={() => setPhotoModalVisible(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setPhotoModalVisible(false)}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          <View style={{ position: 'absolute', top: 56, right: 20 }}>
            <X size={28} color="#FFFFFF" />
          </View>
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={{ width: Dimensions.get('window').width * 0.9, height: Dimensions.get('window').width * 0.9, borderRadius: radius.lg }}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </Screen>
  );
}

