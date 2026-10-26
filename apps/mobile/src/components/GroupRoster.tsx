import React, { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { ChevronDown } from '@tamagui/lucide-icons';
import type { LocalMember } from '../lib/db';
import { useAppColors } from '../context/ThemeContext';
import { fadeIn } from '../theme/animations';
import { motion, radius, space } from '../theme/tokens';
import { AppText, Badge, EmptyState, IconWell, PersonRow, PressableScale, rowPosition, SearchField } from './ui';

type IconType = React.ComponentType<{ size?: number; color?: string }>;

export interface RosterGroup {
  key: string;
  name: string;
  members: LocalMember[];
}

interface GroupRosterProps {
  groups: RosterGroup[];
  icon: IconType;
  /** e.g. "volunteer" → "12 volunteers". */
  memberNoun: string;
  emptyTitle: string;
  refreshing: boolean;
  onRefresh: () => void;
}

/** Expandable list of groups (ministries, zones) with their members. */
export function GroupRoster({ groups, icon, memberNoun, emptyTitle, refreshing, onRefresh }: GroupRosterProps) {
  const c = useAppColors();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const shown = q
    ? groups.filter(g => g.name.toLowerCase().includes(q) || g.members.some(m => m.name.toLowerCase().includes(q)))
    : groups;

  return (
    <FlatList
      data={shown}
      keyExtractor={g => g.key}
      extraData={expanded}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xs, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary.base} colors={[c.primary.base]} />}
      ListHeaderComponent={
        groups.length > 4 ? (
          <View style={{ paddingBottom: space.xs }}>
            <SearchField value={search} onChangeText={setSearch} placeholder={`Search groups or ${memberNoun}s`} />
          </View>
        ) : undefined
      }
      ListEmptyComponent={<EmptyState icon={icon} title={q ? 'Nothing matches' : emptyTitle} />}
      renderItem={({ item }) => (
        <GroupCard
          group={item}
          icon={icon}
          memberNoun={memberNoun}
          open={expanded === item.key || (!!q && item.members.some(m => m.name.toLowerCase().includes(q)))}
          onToggle={() => setExpanded(prev => (prev === item.key ? null : item.key))}
          filter={q}
        />
      )}
    />
  );
}

function GroupCard({ group, icon, memberNoun, open, onToggle, filter }: {
  group: RosterGroup; icon: IconType; memberNoun: string; open: boolean; onToggle: () => void; filter: string;
}) {
  const router = useRouter();
  const c = useAppColors();
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: motion.base }) }],
  }), [open]);
  const members = filter ? group.members.filter(m => m.name.toLowerCase().includes(filter)) : group.members;
  const count = group.members.length;

  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
      <PressableScale
        onPress={onToggle}
        haptics="selection"
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${group.name}, ${count} ${memberNoun}${count === 1 ? '' : 's'}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md }}
      >
        <IconWell icon={icon} tone={count ? 'primary' : 'neutral'} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="headline" numberOfLines={1}>{group.name}</AppText>
          <AppText variant="caption" tone="muted">{count} {memberNoun}{count === 1 ? '' : 's'}</AppText>
        </View>
        <Badge label={String(count)} tone={count ? 'primary' : 'neutral'} />
        <Animated.View style={chevron}>
          <ChevronDown size={20} color={c.textSubtle} />
        </Animated.View>
      </PressableScale>

      {open ? (
        <Animated.View entering={fadeIn()} style={{ paddingHorizontal: space.sm, paddingBottom: space.sm }}>
          {members.length ? (
            members.map((m, i) => (
              <PersonRow
                key={m.id}
                name={m.name}
                photoUri={m.local_photo_path || m.photo_url}
                position={rowPosition(i, members.length)}
                subtitle={m.phone || m.role || undefined}
                phone={m.phone}
                onPress={() => router.push(`/members/${m.id}` as any)}
              />
            ))
          ) : (
            <AppText variant="caption" tone="muted" style={{ padding: space.sm }}>No {memberNoun}s assigned yet.</AppText>
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}
