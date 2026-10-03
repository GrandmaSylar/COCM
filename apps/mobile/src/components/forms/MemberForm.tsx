import React from 'react';
import { FlatList, View } from 'react-native';
import {
  AlertTriangle, Church, FileText, Link2, MapPin, Phone, Plus, ShieldCheck, Trash2, User, Users,
} from '@tamagui/lucide-icons';
import type { LocalMember } from '../../lib/db';
import { useAppColors } from '../../context/ThemeContext';
import { NativeDatePicker } from '../NativeDatePicker';
import {
  AppText, Badge, Button, ChoiceChips, EmptyState, FieldGroup, FormSection, IconButton, PersonRow, PhotoPicker,
  rowPosition, SearchField, SegmentedControl, Sheet, TextField,
} from '../ui';
import { radius, space } from '../../theme/tokens';

export interface FamilyMemberItem {
  id: string;
  relationship: 'mother' | 'father' | 'spouse' | 'child' | 'sibling';
  firstName: string;
  lastName: string;
  otherNames?: string;
  phone?: string;
  isLinked: boolean;
  linkedMemberId?: string | null;
}

/** Everything the form reads and writes; each screen owns the state and passes it in. */
export interface MemberFormBindings {
  photoUri: string | null; setPhotoUri: (v: string | null) => void;
  pickPhotoFromLibrary: () => void; takePhotoWithCamera: () => void;

  firstName: string; setFirstName: (v: string) => void;
  lastName: string; setLastName: (v: string) => void;
  otherNames: string; setOtherNames: (v: string) => void;
  gender: string; setGender: (v: string) => void;
  maritalStatus: string; setMaritalStatus: (v: string) => void;
  dateOfBirth: string; setDateOfBirth: (v: string) => void;
  occupation: string; setOccupation: (v: string) => void;
  hometown: string; setHometown: (v: string) => void;

  phone: string; setPhone: (v: string) => void;
  secondPhone: string; setSecondPhone: (v: string) => void;
  email: string; setEmail: (v: string) => void;

  residenceLocation: string; setResidenceLocation: (v: string) => void;
  digitalAddress: string; setDigitalAddress: (v: string) => void;
  zonesList: string[];
  zone: string; setZone: (v: string) => void;
  zoneNumber: string; setZoneNumber: (v: string) => void;
  conflictingMember: LocalMember | null;

  baptismStatus: 'baptised' | 'not_baptised'; setBaptismStatus: (v: 'baptised' | 'not_baptised') => void;
  baptismDateType: string; setBaptismDateType: (v: any) => void;
  baptismFullDate: string; setBaptismFullDate: (v: string) => void;
  baptismMonth: string; setBaptismMonth: (v: string) => void;
  baptismYear: string; setBaptismYear: (v: string) => void;
  previousCongregation: string; setPreviousCongregation: (v: string) => void;
  roleInPreviousCongregation: string; setRoleInPreviousCongregation: (v: string) => void;

  ministriesList: string[]; selectedMinistries: string[]; toggleMinistry: (m: string) => void;
  positionsList: string[]; selectedPositions: string[]; togglePosition: (p: string) => void;

  familyMembers: FamilyMemberItem[];
  handleAddFamilyMember: () => void;
  handleRemoveFamilyMember: (index: number) => void;
  handleUpdateFamilyMember: (index: number, field: string, value: any) => void;
  openMemberPicker: (index: number) => void;

  memberPickerVisible: boolean; setMemberPickerVisible: (v: boolean) => void;
  searchMemberQuery: string; setSearchMemberQuery: (v: string) => void;
  filteredMembers: LocalMember[];
  selectMemberAsRelative: (m: LocalMember) => void;

  statuses: readonly string[];
  status: string; setStatus: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
}

export interface MemberFormErrors {
  firstName?: string;
  lastName?: string;
  phone?: string;
  zoneNumber?: string;
}

const GENDERS = ['male', 'female'] as const;
const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'] as const;
const RELATIONSHIPS = ['father', 'mother', 'spouse', 'child', 'sibling'] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Same 8-part completion measure the add screen always used. */
export function memberFormProgress(f: MemberFormBindings) {
  let filled = 0;
  if (f.firstName && f.lastName) filled++;
  if (f.phone) filled++;
  if (f.residenceLocation && f.zone) filled++;
  if (f.baptismStatus) filled++;
  if (f.selectedMinistries.length > 0 || f.selectedPositions.length > 0) filled++;
  if (f.familyMembers.length > 0) filled++;
  if (f.status) filled++;
  if (f.notes || f.occupation) filled++;
  return Math.round((filled / 8) * 100);
}

export function MemberForm({ form: f, errors = {}, requirePhone }: { form: MemberFormBindings; errors?: MemberFormErrors; requirePhone?: boolean }) {
  const c = useAppColors();
  const fullName = `${f.firstName} ${f.lastName}`.trim();

  return (
    <View style={{ gap: space.md }}>
      <FormSection
        title="Basic information"
        icon={User}
        description="Name, photo, gender and birth date"
        state={f.firstName && f.lastName ? 'done' : 'needed'}
      >
        <PhotoPicker
          name={fullName}
          uri={f.photoUri}
          onPickLibrary={f.pickPhotoFromLibrary}
          onTakePhoto={f.takePhotoWithCamera}
          onRemove={() => f.setPhotoUri(null)}
        />
        <TextField label="First name *" value={f.firstName} onChangeText={f.setFirstName} placeholder="e.g. Samuel" error={errors.firstName} autoCapitalize="words" />
        <TextField label="Last name *" value={f.lastName} onChangeText={f.setLastName} placeholder="e.g. Mensah" error={errors.lastName} autoCapitalize="words" />
        <TextField label="Other names" value={f.otherNames} onChangeText={f.setOtherNames} placeholder="e.g. Kwabena" autoCapitalize="words" />
        <FieldGroup label="Gender *">
          <SegmentedControl
            accessibilityLabel="Gender"
            value={f.gender as any}
            onChange={f.setGender}
            options={GENDERS.map(g => ({ value: g, label: cap(g) }))}
          />
        </FieldGroup>
        <FieldGroup label="Marital status">
          <ChoiceChips options={MARITAL_STATUSES} value={f.maritalStatus as any} onChange={f.setMaritalStatus} format={cap} />
        </FieldGroup>
        <NativeDatePicker label="Date of birth" required value={f.dateOfBirth} onChange={f.setDateOfBirth} placeholder="YYYY-MM-DD" maxDate={new Date()} />
        <TextField label="Occupation" value={f.occupation} onChangeText={f.setOccupation} placeholder="e.g. Civil engineer" />
        <TextField label="Hometown" value={f.hometown} onChangeText={f.setHometown} placeholder="e.g. Mampong" />
      </FormSection>

      <FormSection
        title="Contact"
        icon={Phone}
        description="Phone numbers and email"
        state={f.phone ? 'done' : requirePhone ? 'needed' : 'optional'}
      >
        <TextField label={requirePhone ? 'Primary phone *' : 'Primary phone'} value={f.phone} onChangeText={f.setPhone} keyboardType="phone-pad" placeholder="e.g. 0244 123 456" error={errors.phone} textContentType="telephoneNumber" />
        <TextField label="Second phone" value={f.secondPhone} onChangeText={f.setSecondPhone} keyboardType="phone-pad" placeholder="Optional" />
        <TextField label="Email" value={f.email} onChangeText={f.setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="name@example.com" />
      </FormSection>

      <FormSection
        title="Location & zone"
        icon={MapPin}
        description="Residence, zone and zone number"
        state={errors.zoneNumber || f.conflictingMember ? 'needed' : f.residenceLocation && f.zone ? 'done' : 'optional'}
      >
        <TextField label="Residential area" value={f.residenceLocation} onChangeText={f.setResidenceLocation} placeholder="e.g. Bubiashie, Accra" />
        <TextField label="Digital address" value={f.digitalAddress} onChangeText={f.setDigitalAddress} placeholder="e.g. GA-183-9201" autoCapitalize="characters" />
        <FieldGroup label="Church zone *">
          <ChoiceChips options={f.zonesList.map(z => ({ value: z, label: `Zone ${z}` }))} value={f.zone} onChange={f.setZone} />
        </FieldGroup>
        <TextField
          label="Zone number"
          value={f.zoneNumber}
          onChangeText={f.setZoneNumber}
          placeholder="e.g. A01"
          autoCapitalize="characters"
          error={errors.zoneNumber}
          helper={!f.conflictingMember ? 'Suggested automatically; you can change it.' : undefined}
        />
        {f.conflictingMember ? (
          <View style={{ flexDirection: 'row', gap: 10, padding: space.sm, borderRadius: radius.md, backgroundColor: c.warning.soft }}>
            <AlertTriangle size={18} color={c.warning.text} />
            <AppText variant="caption" tone="warning" style={{ flex: 1 }}>
              {f.zoneNumber} is already assigned to {f.conflictingMember.name} (Zone {f.conflictingMember.zone || 'N/A'}). Choose a different number.
            </AppText>
          </View>
        ) : null}
      </FormSection>

      <FormSection title="Baptism" icon={Church} description="Status, date and previous congregation" state={f.baptismStatus ? 'done' : 'optional'}>
        <SegmentedControl
          accessibilityLabel="Baptism status"
          value={f.baptismStatus}
          onChange={f.setBaptismStatus}
          options={[{ value: 'baptised', label: 'Baptised' }, { value: 'not_baptised', label: 'Not baptised' }]}
        />
        {f.baptismStatus === 'baptised' ? (
          <>
            <FieldGroup label="What do you know about the date?">
              <ChoiceChips
                options={[
                  { value: 'full', label: 'Full date' },
                  { value: 'monthYear', label: 'Month & year' },
                  { value: 'yearOnly', label: 'Year only' },
                  { value: 'forgotten', label: 'Don’t remember' },
                ]}
                value={f.baptismDateType}
                onChange={f.setBaptismDateType}
              />
            </FieldGroup>
            {f.baptismDateType === 'full' ? (
              <NativeDatePicker label="Baptism date" value={f.baptismFullDate} onChange={f.setBaptismFullDate} maxDate={new Date()} />
            ) : null}
            {f.baptismDateType === 'monthYear' ? (
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                <View style={{ flex: 1 }}><TextField label="Month" value={f.baptismMonth} onChangeText={f.setBaptismMonth} placeholder="1–12" keyboardType="number-pad" maxLength={2} /></View>
                <View style={{ flex: 1 }}><TextField label="Year" value={f.baptismYear} onChangeText={f.setBaptismYear} placeholder="YYYY" keyboardType="number-pad" maxLength={4} /></View>
              </View>
            ) : null}
            {f.baptismDateType === 'yearOnly' ? (
              <TextField label="Year" value={f.baptismYear} onChangeText={f.setBaptismYear} placeholder="YYYY" keyboardType="number-pad" maxLength={4} />
            ) : null}
            <TextField label="Previous congregation" value={f.previousCongregation} onChangeText={f.setPreviousCongregation} placeholder="e.g. Assemblies of God" />
            <TextField label="Role there" value={f.roleInPreviousCongregation} onChangeText={f.setRoleInPreviousCongregation} placeholder="e.g. Deacon, youth leader" />
          </>
        ) : null}
      </FormSection>

      <FormSection
        title="Ministries & positions"
        icon={ShieldCheck}
        description={f.selectedMinistries.length + f.selectedPositions.length > 0 ? `${f.selectedMinistries.length} ministries · ${f.selectedPositions.length} positions` : 'Teams and roles in church'}
        state={f.selectedMinistries.length + f.selectedPositions.length > 0 ? 'done' : 'optional'}
        defaultOpen={false}
      >
        <FieldGroup label="Ministries">
          {f.ministriesList.length ? (
            <ChoiceChips options={f.ministriesList} value={f.selectedMinistries} onChange={f.toggleMinistry} />
          ) : <AppText variant="caption" tone="subtle">No ministries configured.</AppText>}
        </FieldGroup>
        <FieldGroup label="Positions held">
          {f.positionsList.length ? (
            <ChoiceChips options={f.positionsList} value={f.selectedPositions} onChange={f.togglePosition} />
          ) : <AppText variant="caption" tone="subtle">No positions configured.</AppText>}
        </FieldGroup>
      </FormSection>

      <FormSection
        title="Family"
        icon={Users}
        description={f.familyMembers.length ? `${f.familyMembers.length} ${f.familyMembers.length === 1 ? 'relative' : 'relatives'}` : 'Parents, spouse, children, siblings'}
        state={f.familyMembers.length ? 'done' : 'optional'}
        defaultOpen={f.familyMembers.length > 0}
      >
        {f.familyMembers.length === 0 ? (
          <AppText variant="caption" tone="muted">No relatives added yet.</AppText>
        ) : (
          f.familyMembers.map((fm, idx) => (
            <View key={fm.id || idx} style={{ gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: c.surfaceMuted }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <AppText variant="captionStrong" style={{ flex: 1 }}>Relative {idx + 1}</AppText>
                {fm.isLinked ? <Badge label="Linked member" tone="success" /> : null}
                <IconButton icon={Trash2} label={`Remove relative ${idx + 1}`} tone="danger" size={36} onPress={() => f.handleRemoveFamilyMember(idx)} />
              </View>
              <Button
                label={fm.isLinked ? 'Change linked member' : 'Pick from church directory'}
                icon={Link2}
                size="sm"
                variant={fm.isLinked ? 'secondary' : 'soft'}
                fullWidth
                onPress={() => f.openMemberPicker(idx)}
              />
              <ChoiceChips options={RELATIONSHIPS} value={fm.relationship} onChange={rel => f.handleUpdateFamilyMember(idx, 'relationship', rel)} format={cap} />
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                <View style={{ flex: 1 }}><TextField placeholder="First name" value={fm.firstName} onChangeText={t => f.handleUpdateFamilyMember(idx, 'firstName', t)} accessibilityLabel={`Relative ${idx + 1} first name`} /></View>
                <View style={{ flex: 1 }}><TextField placeholder="Last name" value={fm.lastName} onChangeText={t => f.handleUpdateFamilyMember(idx, 'lastName', t)} accessibilityLabel={`Relative ${idx + 1} last name`} /></View>
              </View>
              <TextField placeholder="Phone" value={fm.phone || ''} onChangeText={t => f.handleUpdateFamilyMember(idx, 'phone', t)} keyboardType="phone-pad" accessibilityLabel={`Relative ${idx + 1} phone`} />
            </View>
          ))
        )}
        <Button label="Add relative" icon={Plus} variant="soft" fullWidth onPress={f.handleAddFamilyMember} />
      </FormSection>

      <FormSection title="Status & notes" icon={FileText} description={cap(f.status || 'new')} state="optional" defaultOpen={false}>
        <FieldGroup label="Status">
          <ChoiceChips options={f.statuses as string[]} value={f.status} onChange={f.setStatus} format={cap} />
        </FieldGroup>
        <TextField label="Notes" value={f.notes} onChangeText={f.setNotes} placeholder="Administrative notes" multiline />
      </FormSection>

      {/* Church directory picker for linking relatives */}
      <Sheet
        visible={f.memberPickerVisible}
        onClose={() => f.setMemberPickerVisible(false)}
        title="Link a church member"
        subtitle="Their name and phone fill in automatically"
        noScroll
      >
        <View style={{ gap: space.sm, height: 460 }}>
          <SearchField value={f.searchMemberQuery} onChangeText={f.setSearchMemberQuery} placeholder="Search members by name" />
          <FlatList
            data={f.filteredMembers}
            keyExtractor={m => m.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: space.md }}
            ListEmptyComponent={<EmptyState icon={Users} title="No members found" />}
            renderItem={({ item, index }) => (
              <PersonRow
                name={item.name}
                position={rowPosition(index, f.filteredMembers.length)}
                subtitle={item.phone || item.email || (item.zone ? `Zone ${item.zone}` : 'Member')}
                onPress={() => f.selectMemberAsRelative(item)}
              />
            )}
          />
        </View>
      </Sheet>
    </View>
  );
}
