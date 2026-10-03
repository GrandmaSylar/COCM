import React from 'react';
import { FlatList, View } from 'react-native';
import { Baby, Link2, MapPin, Plus, Trash2, Users } from '@tamagui/lucide-icons';
import type { LocalMember } from '../../lib/db';
import { useAppColors } from '../../context/ThemeContext';
import { NativeDatePicker } from '../NativeDatePicker';
import {
  AppText, Badge, Button, ChoiceChips, EmptyState, FieldGroup, FormSection, IconButton, PersonRow, PhotoPicker,
  rowPosition, SearchField, SegmentedControl, Sheet, TextField,
} from '../ui';
import { radius, space } from '../../theme/tokens';

export interface ChildParentItem {
  id: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  phone?: string;
  relationship: 'mother' | 'father' | 'guardian';
  isLinked: boolean;
  linkedMemberId?: string;
}

export interface ChildFormBindings {
  photoUri: string | null; setPhotoUri: (v: string | null) => void;
  pickPhotoFromLibrary: () => void; takePhotoWithCamera: () => void;
  firstName: string; setFirstName: (v: string) => void;
  lastName: string; setLastName: (v: string) => void;
  otherNames: string; setOtherNames: (v: string) => void;
  gender: 'male' | 'female'; setGender: (v: 'male' | 'female') => void;
  dateOfBirth: string; setDateOfBirth: (v: string) => void;
  status: 'active' | 'inactive'; setStatus: (v: 'active' | 'inactive') => void;
  zones: string[];
  zone: string; setZone: (v: string) => void;

  parents: ChildParentItem[];
  updateParent: (index: number, patch: Partial<ChildParentItem>) => void;
  handleAddParent: () => void;
  handleRemoveParent: (index: number) => void;
  openMemberPicker: (index: number) => void;
  memberPickerVisible: boolean; setMemberPickerVisible: (v: boolean) => void;
  searchMemberQuery: string; setSearchMemberQuery: (v: string) => void;
  filteredMembers: LocalMember[];
  selectMemberAsParent: (m: LocalMember) => void;

  residenceLocation: string; setResidenceLocation: (v: string) => void;
  digitalAddress: string; setDigitalAddress: (v: string) => void;
  hometown: string; setHometown: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
}

export interface ChildFormErrors {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
}

const RELATIONSHIPS = ['mother', 'father', 'guardian'] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ChildForm({ form: f, errors = {} }: { form: ChildFormBindings; errors?: ChildFormErrors }) {
  const c = useAppColors();
  const basicsDone = !!(f.firstName && f.lastName && f.dateOfBirth);

  return (
    <View style={{ gap: space.md }}>
      <FormSection title="Child" icon={Baby} description="Name, photo, birth date and zone" state={basicsDone ? 'done' : 'needed'}>
        <PhotoPicker
          name={`${f.firstName} ${f.lastName}`.trim()}
          uri={f.photoUri}
          onPickLibrary={f.pickPhotoFromLibrary}
          onTakePhoto={f.takePhotoWithCamera}
          onRemove={() => f.setPhotoUri(null)}
        />
        <TextField label="First name *" value={f.firstName} onChangeText={f.setFirstName} placeholder="e.g. Samuel" autoCapitalize="words" error={errors.firstName} />
        <TextField label="Last name *" value={f.lastName} onChangeText={f.setLastName} placeholder="e.g. Mensah" autoCapitalize="words" error={errors.lastName} />
        <TextField label="Other names" value={f.otherNames} onChangeText={f.setOtherNames} placeholder="e.g. Kwabena" autoCapitalize="words" />
        <FieldGroup label="Gender *">
          <SegmentedControl
            accessibilityLabel="Gender"
            value={f.gender}
            onChange={f.setGender}
            options={[{ value: 'male', label: 'Boy' }, { value: 'female', label: 'Girl' }]}
          />
        </FieldGroup>
        <NativeDatePicker
          label="Date of birth"
          required
          value={f.dateOfBirth}
          onChange={f.setDateOfBirth}
          placeholder="YYYY-MM-DD"
          maxDate={new Date()}
          error={errors.dateOfBirth}
        />
        <FieldGroup label="Status">
          <SegmentedControl
            accessibilityLabel="Status"
            value={f.status}
            onChange={f.setStatus}
            options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
          />
        </FieldGroup>
        {f.zones.length ? (
          <FieldGroup label="Church zone">
            <ChoiceChips options={f.zones.map(z => ({ value: z, label: `Zone ${z}` }))} value={f.zone} onChange={f.setZone} />
          </FieldGroup>
        ) : null}
      </FormSection>

      <FormSection
        title="Parents & guardians"
        icon={Users}
        description={f.parents.length ? `${f.parents.length} linked` : 'Who to contact about this child'}
        state={f.parents.length ? 'done' : 'optional'}
      >
        {f.parents.length === 0 ? <AppText variant="caption" tone="muted">No parents or guardians added yet.</AppText> : null}
        {f.parents.map((parent, idx) => (
          <View key={parent.id} style={{ gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: c.surfaceMuted }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <AppText variant="captionStrong" style={{ flex: 1 }}>Guardian {idx + 1}</AppText>
              {parent.isLinked ? <Badge label="Linked member" tone="success" /> : null}
              <IconButton icon={Trash2} label={`Remove guardian ${idx + 1}`} tone="danger" size={36} onPress={() => f.handleRemoveParent(idx)} />
            </View>
            <Button
              label={parent.isLinked ? 'Change linked member' : 'Pick from church directory'}
              icon={Link2}
              size="sm"
              variant={parent.isLinked ? 'secondary' : 'soft'}
              fullWidth
              onPress={() => f.openMemberPicker(idx)}
            />
            <ChoiceChips options={RELATIONSHIPS} value={parent.relationship} onChange={r => f.updateParent(idx, { relationship: r })} format={cap} />
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              <View style={{ flex: 1 }}><TextField placeholder="First name" value={parent.firstName} onChangeText={v => f.updateParent(idx, { firstName: v })} accessibilityLabel={`Guardian ${idx + 1} first name`} /></View>
              <View style={{ flex: 1 }}><TextField placeholder="Last name" value={parent.lastName} onChangeText={v => f.updateParent(idx, { lastName: v })} accessibilityLabel={`Guardian ${idx + 1} last name`} /></View>
            </View>
            <TextField placeholder="Phone" value={parent.phone || ''} onChangeText={v => f.updateParent(idx, { phone: v })} keyboardType="phone-pad" accessibilityLabel={`Guardian ${idx + 1} phone`} />
          </View>
        ))}
        <Button label="Add guardian" icon={Plus} variant="soft" fullWidth onPress={f.handleAddParent} />
      </FormSection>

      <FormSection
        title="Location & notes"
        icon={MapPin}
        description="Residence, hometown, notes"
        state={f.residenceLocation ? 'done' : 'optional'}
        defaultOpen={false}
      >
        <TextField label="Residential area" value={f.residenceLocation} onChangeText={f.setResidenceLocation} placeholder="e.g. Tantra Hills, Accra" />
        <TextField label="Digital address" value={f.digitalAddress} onChangeText={f.setDigitalAddress} placeholder="e.g. GE-123-4567" autoCapitalize="characters" />
        <TextField label="Hometown" value={f.hometown} onChangeText={f.setHometown} placeholder="e.g. Kumasi" />
        <TextField label="Notes" value={f.notes} onChangeText={f.setNotes} placeholder="Health notes, school…" multiline />
      </FormSection>

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
                subtitle={item.phone || item.email || 'Member'}
                onPress={() => f.selectMemberAsParent(item)}
              />
            )}
          />
        </View>
      </Sheet>
    </View>
  );
}
