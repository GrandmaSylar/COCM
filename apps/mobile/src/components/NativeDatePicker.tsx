import React, { useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar } from '@tamagui/lucide-icons';
import { useAppColors } from '../context/ThemeContext';
import { fonts, radius } from '../theme/tokens';
import { AppText, Button, IconButton, Sheet } from './ui';

export interface NativeDatePickerProps {
  value: string;
  onChange: (dateStr: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  maxDate?: Date;
  minDate?: Date;
  /** Inline validation message. */
  error?: string | null;
  /** @deprecated colors follow the theme now; kept for call-site compatibility */
  accentColor?: string;
  /** @deprecated */
  backgroundColor?: string;
  /** @deprecated */
  borderColor?: string;
}

const formatDateToString = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function parse(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/** Date field: type YYYY-MM-DD or pick from the native calendar. Shows the date in words underneath. */
export function NativeDatePicker({
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
  label,
  required = false,
  maxDate,
  minDate,
  error,
}: NativeDatePickerProps) {
  const c = useAppColors();
  const [showPicker, setShowPicker] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() => parse(value) ?? new Date());

  const current = parse(value);
  const readable = current
    ? current.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const open = () => {
    setTempDate(parse(value) ?? new Date());
    setShowPicker(true);
  };

  const borderColor = error ? c.danger.base : focused ? c.primary.base : c.borderStrong;

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <AppText variant="label" tone="muted">
          {label}{required ? ' *' : ''}
        </AppText>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 48,
          paddingLeft: 14,
          paddingRight: 4,
          gap: 8,
          borderRadius: radius.md,
          borderWidth: focused || error ? 1.5 : 1,
          borderColor,
          backgroundColor: c.surface,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={c.textSubtle}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label ?? 'Date'}
          style={{ flex: 1, minHeight: 46, color: c.text, fontFamily: fonts.body, fontSize: 15, paddingVertical: 0 }}
        />
        <IconButton icon={Calendar} label={`Choose ${label ? label.toLowerCase() : 'date'}`} tone="primary" size={40} onPress={open} />
      </View>

      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">{error}</AppText>
      ) : readable ? (
        <AppText variant="caption" tone="subtle">{readable}</AppText>
      ) : null}

      {/* Android: system dialog */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={parse(value) ?? new Date()}
          mode="date"
          display="default"
          maximumDate={maxDate}
          minimumDate={minDate}
          onValueChange={(_, d) => {
            setShowPicker(false);
            if (d) onChange(formatDateToString(d));
          }}
          onDismiss={() => setShowPicker(false)}
        />
      )}

      {/* iOS: spinner in a bottom sheet */}
      {Platform.OS === 'ios' && (
        <Sheet
          visible={showPicker}
          onClose={() => setShowPicker(false)}
          title={label ?? 'Select date'}
          noScroll
          footer={
            <Button
              label="Done"
              fullWidth
              onPress={() => {
                onChange(formatDateToString(tempDate));
                setShowPicker(false);
              }}
            />
          }
        >
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="spinner"
            maximumDate={maxDate}
            minimumDate={minDate}
            onValueChange={(_, d) => {
              if (d) setTempDate(d);
            }}
            style={{ height: 200 }}
          />
        </Sheet>
      )}

      {/* Web fallback (Expo web preview) */}
      {Platform.OS === 'web' && showPicker && (
        React.createElement('input', {
          type: 'date',
          value: value,
          onChange: (e: any) => {
            onChange(e.target.value);
            setShowPicker(false);
          },
          max: maxDate ? formatDateToString(maxDate) : undefined,
          min: minDate ? formatDateToString(minDate) : undefined,
          style: {
            padding: 8,
            borderRadius: 8,
            border: `1px solid ${c.borderStrong}`,
            backgroundColor: c.surface,
            color: c.text,
            fontSize: 14,
            marginTop: 4,
          },
        })
      )}
    </View>
  );
}
