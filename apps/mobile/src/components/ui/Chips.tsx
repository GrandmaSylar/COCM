import React from 'react';
import { ScrollView } from 'react-native';
import { useAppColors } from '../../context/ThemeContext';
import { radius } from '../../theme/tokens';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type IconType = React.ComponentType<{ size?: number; color?: string }>;

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconType;
}

export function Chip({ label, selected, onPress, icon: Icon }: ChipProps) {
  const c = useAppColors();
  const fg = selected ? c.primary.text : c.textMuted;
  return (
    <PressableScale
      onPress={onPress}
      haptics="selection"
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      hitSlop={{ top: 4, bottom: 4 }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 36,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? c.primary.base : c.border,
        backgroundColor: selected ? c.primary.soft : c.surface,
      }}
    >
      {Icon ? <Icon size={15} color={fg} /> : null}
      <AppText variant={selected ? 'captionStrong' : 'caption'} color={fg}>
        {label}
      </AppText>
    </PressableScale>
  );
}

export interface FilterChipsProps<T extends string> {
  options: { value: T; label: string; icon?: IconType }[];
  value: T;
  onChange: (value: T) => void;
}

/** Single-select horizontal chip row that bleeds to the screen edges. */
export function FilterChips<T extends string>({ options, value, onChange }: FilterChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
      style={{ marginHorizontal: -16, flexGrow: 0 }}
    >
      {options.map(o => (
        <Chip key={o.value} label={o.label} icon={o.icon} selected={o.value === value} onPress={() => onChange(o.value)} />
      ))}
    </ScrollView>
  );
}
