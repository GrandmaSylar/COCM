import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Check, ChevronDown, Image as ImageIcon, Trash2 } from '@tamagui/lucide-icons';
import { useAppColors } from '../../context/ThemeContext';
import { motion, radius, space } from '../../theme/tokens';
import { haptic } from '../../theme/haptics';
import { fadeIn } from '../../theme/animations';
import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { IconWell } from './List';
import { ProgressBar } from './Feedback';

type IconType = React.ComponentType<{ size?: number; color?: string }>;

export interface FormSectionProps {
  title: string;
  icon?: IconType;
  /** Small line under the title. */
  description?: string;
  /** 'done' shows a check, 'needed' a required marker. */
  state?: 'done' | 'needed' | 'optional';
  defaultOpen?: boolean;
  children: React.ReactNode;
  /** Right side of the header (e.g. "Add relative"). */
  action?: React.ReactNode;
}

/** Collapsible group of fields in long forms. */
export function FormSection({ title, icon, description, state, defaultOpen = true, children, action }: FormSectionProps) {
  const c = useAppColors();
  const [open, setOpen] = useState(defaultOpen);
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: motion.base }) }],
  }), [open]);

  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
      <Pressable
        onPress={() => { haptic.selection(); setOpen(o => !o); }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}${state === 'needed' ? ', required fields missing' : state === 'done' ? ', complete' : ''}`}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md,
          backgroundColor: pressed ? c.surfaceMuted : 'transparent',
        })}
      >
        {icon ? <IconWell icon={icon} tone={state === 'needed' ? 'warning' : 'primary'} size={36} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="headline">{title}</AppText>
          {description ? <AppText variant="caption" tone="muted" numberOfLines={1}>{description}</AppText> : null}
        </View>
        {state === 'done' ? (
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.success.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Check size={14} color={c.success.text} />
          </View>
        ) : state === 'needed' ? (
          <Badge label="Required" tone="warning" />
        ) : null}
        {action}
        <Animated.View style={chevron}>
          <ChevronDown size={20} color={c.textSubtle} />
        </Animated.View>
      </Pressable>
      {open ? (
        <Animated.View entering={fadeIn()} style={{ paddingHorizontal: space.md, paddingBottom: space.md, gap: space.md }}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

export interface SaveBarProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** 0–100; shows a thin completion bar. */
  progress?: number;
  /** Text next to the progress (e.g. "3 of 8 sections"). */
  hint?: string;
}

/** Primary action pinned to the bottom of long forms. */
export function SaveBar({ label, onPress, loading, disabled, progress, hint }: SaveBarProps) {
  const c = useAppColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingHorizontal: space.md,
        paddingTop: space.sm,
        paddingBottom: Math.max(insets.bottom, space.sm),
        gap: space.xs,
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.border,
      }}
    >
      {progress !== undefined ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1 }}><ProgressBar percent={progress} color={c.primary.base} /></View>
          <AppText variant="caption" tone="muted" numeric>{hint ?? `${progress}% complete`}</AppText>
        </View>
      ) : null}
      <Button label={label} loading={loading} disabled={disabled} fullWidth onPress={onPress} />
    </View>
  );
}

export interface ChoiceChipsProps<T extends string> {
  options: readonly T[] | { value: T; label: string }[];
  /** Single value or array (multi-select). */
  value: T | T[];
  onChange: (value: T) => void;
  /** Formats plain string options for display. */
  format?: (v: T) => string;
}

/** Wrapping chip group for single or multiple choice inside forms. */
export function ChoiceChips<T extends string>({ options, value, onChange, format }: ChoiceChipsProps<T>) {
  const c = useAppColors();
  const items = (options as any[]).map(o => (typeof o === 'string' ? { value: o as T, label: format ? format(o as T) : o } : o)) as { value: T; label: string }[];
  const isSelected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  const multi = Array.isArray(value);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole={multi ? undefined : 'radiogroup'}>
      {items.map(item => {
        const selected = isSelected(item.value);
        return (
          <Pressable
            key={item.value}
            onPress={() => { haptic.selection(); onChange(item.value); }}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={multi ? { checked: selected } : { selected }}
            hitSlop={{ top: 4, bottom: 4 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              minHeight: 38,
              paddingHorizontal: 14,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: selected ? c.primary.base : c.borderStrong,
              backgroundColor: selected ? c.primary.soft : c.surface,
            }}
          >
            {selected && multi ? <Check size={14} color={c.primary.text} /> : null}
            <AppText variant={selected ? 'captionStrong' : 'caption'} color={selected ? c.primary.text : c.text}>
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Labelled wrapper for non-text inputs (chips, toggles) so they line up with TextField. */
export function FieldGroup({ label, children, error, helper }: { label: string; children: React.ReactNode; error?: string | null; helper?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label" tone="muted">{label}</AppText>
      {children}
      {error ? <AppText variant="caption" tone="danger">{error}</AppText> : helper ? <AppText variant="caption" tone="subtle">{helper}</AppText> : null}
    </View>
  );
}

export interface PhotoPickerProps {
  name: string;
  uri?: string | null;
  onPickLibrary: () => void;
  onTakePhoto: () => void;
  onRemove: () => void;
}

export function PhotoPicker({ name, uri, onPickLibrary, onTakePhoto, onRemove }: PhotoPickerProps) {
  return (
    <View style={{ alignItems: 'center', gap: space.sm }}>
      <Avatar name={name || '?'} uri={uri} size={96} />
      <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button label="Choose photo" icon={ImageIcon} size="sm" variant="soft" onPress={onPickLibrary} />
        <Button label="Take photo" icon={Camera} size="sm" variant="secondary" onPress={onTakePhoto} />
        {uri ? <Button label="Remove" icon={Trash2} size="sm" variant="dangerSoft" onPress={onRemove} /> : null}
      </View>
    </View>
  );
}
