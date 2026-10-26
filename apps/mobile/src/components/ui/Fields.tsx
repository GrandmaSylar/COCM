import React, { useState } from 'react';
import { Pressable, TextInput, TextInputProps, View } from 'react-native';
import { Eye, EyeOff, Search, X } from '@tamagui/lucide-icons';
import { useAppColors } from '../../context/ThemeContext';
import { fonts, radius } from '../../theme/tokens';
import { AppText } from './AppText';

export interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
}

export function SearchField({ value, onChangeText, placeholder = 'Search', onSubmitEditing, autoFocus }: SearchFieldProps) {
  const c = useAppColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 44,
        paddingHorizontal: 12,
        borderRadius: radius.md,
        backgroundColor: c.surfaceMuted,
      }}
    >
      <Search size={18} color={c.textSubtle} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textSubtle}
        returnKeyType="search"
        autoCorrect={false}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        accessibilityLabel={placeholder}
        style={{ flex: 1, color: c.text, fontFamily: fonts.body, fontSize: 15, paddingVertical: 0 }}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
          <X size={16} color={c.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

type IconType = React.ComponentType<{ size?: number; color?: string }>;

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  /** Inline validation message; also turns the border red. */
  error?: string | null;
  helper?: string;
  /** Icon inside the field, on the left. */
  icon?: IconType;
  /** Fixed text before the value, e.g. "GH₵". */
  prefix?: string;
}

export function TextField({ label, error, helper, multiline, icon: Icon, prefix, secureTextEntry, ...input }: TextFieldProps) {
  const c = useAppColors();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const borderColor = error ? c.danger.base : focused ? c.primary.base : c.borderStrong;

  return (
    <View style={{ gap: 6 }}>
      {label ? <AppText variant="label" tone="muted">{label}</AppText> : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          minHeight: multiline ? 96 : 48,
          paddingHorizontal: 14,
          gap: 10,
          borderRadius: radius.md,
          borderWidth: focused || error ? 1.5 : 1,
          borderColor,
          backgroundColor: c.surface,
        }}
      >
        {Icon ? (
          <View style={{ paddingTop: multiline ? 14 : 0 }}>
            <Icon size={18} color={focused ? c.primary.text : c.textSubtle} />
          </View>
        ) : null}
        {prefix ? <AppText variant="bodyMedium" tone="muted">{prefix}</AppText> : null}
        <TextInput
          placeholderTextColor={c.textSubtle}
          {...input}
          multiline={multiline}
          secureTextEntry={secureTextEntry && !revealed}
          accessibilityLabel={input.accessibilityLabel ?? label}
          onFocus={e => { setFocused(true); input.onFocus?.(e); }}
          onBlur={e => { setFocused(false); input.onBlur?.(e); }}
          style={{
            flex: 1,
            minHeight: multiline ? 96 : 46,
            paddingVertical: multiline ? 12 : 0,
            textAlignVertical: multiline ? 'top' : 'center',
            color: c.text,
            fontFamily: fonts.body,
            fontSize: 15,
          }}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setRevealed(r => !r)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            {revealed ? <EyeOff size={18} color={c.textSubtle} /> : <Eye size={18} color={c.textSubtle} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">{error}</AppText>
      ) : helper ? (
        <AppText variant="caption" tone="subtle">{helper}</AppText>
      ) : null}
    </View>
  );
}
