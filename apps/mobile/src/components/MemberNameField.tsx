import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Search, UserCheck } from '@tamagui/lucide-icons';
import type { LocalMember } from '../lib/db';
import { useAppColors } from '../context/ThemeContext';
import { radius, space } from '../theme/tokens';
import { AppText, Avatar, PressableScale, TextField } from './ui';

const MAX_SUGGESTIONS = 6;

export interface MemberNameFieldProps {
  label: string;
  /** Typed or selected name. */
  value: string;
  /** Id of the selected member; undefined while the name is free text. */
  memberId?: string;
  members: LocalMember[];
  onChange: (memberId: string | undefined, name: string) => void;
}

/**
 * Name input that suggests members as you type (the web's MemberCombobox).
 * Picking a suggestion links the member id; typing again unlinks it.
 */
export function MemberNameField({ label, value, memberId, members, onChange }: MemberNameFieldProps) {
  const c = useAppColors();
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    const term = value.trim().toLowerCase();
    if (!term) return [];
    const matches = members.filter(m => (m.name || '').toLowerCase().includes(term));
    // Names that start with the term (or a word that does) rank first.
    const rank = (m: LocalMember) => {
      const n = (m.name || '').toLowerCase();
      if (n.startsWith(term)) return 0;
      return n.split(/\s+/).some(w => w.startsWith(term)) ? 1 : 2;
    };
    return matches.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, MAX_SUGGESTIONS);
  }, [members, value]);

  const showList = focused && !memberId && suggestions.length > 0;
  const noMatch = focused && !memberId && value.trim().length > 1 && suggestions.length === 0;

  return (
    <View style={{ gap: space.xxs }}>
      <TextField
        label={label}
        icon={memberId ? UserCheck : Search}
        value={value}
        onChangeText={t => onChange(undefined, t)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search members"
        autoCapitalize="words"
        autoCorrect={false}
        helper={memberId ? 'Linked to member record' : noMatch ? 'No member matches — the name will be saved as typed' : undefined}
      />
      {showList ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
            backgroundColor: c.surface,
            overflow: 'hidden',
          }}
          accessibilityLabel={`${suggestions.length} matching members`}
        >
          {suggestions.map((m, i) => (
            <PressableScale
              key={m.id}
              scaleTo={0.985}
              onPress={() => {
                onChange(m.id, m.name);
                setFocused(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Select ${m.name}`}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.sm,
                  paddingHorizontal: space.sm,
                  minHeight: 48,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: c.border,
                }}
              >
                <Avatar name={m.name} size={30} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMedium" numberOfLines={1}>{m.name}</AppText>
                  {m.zone ? <AppText variant="caption" tone="muted" numberOfLines={1}>{m.zone}</AppText> : null}
                </View>
              </View>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </View>
  );
}
