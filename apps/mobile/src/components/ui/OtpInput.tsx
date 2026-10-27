import React, { useRef, useState, type ComponentRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useAppColors } from '../../context/ThemeContext';
import { fonts, radius } from '../../theme/tokens';

export interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
}

/** One hidden numeric input rendered as separate digit boxes (supports paste and SMS autofill). */
export function OtpInput({ value, onChange, length = 6, error, autoFocus, onComplete }: OtpInputProps) {
  const c = useAppColors();
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityRole="none">
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        {Array.from({ length }).map((_, i) => {
          const char = value[i] ?? '';
          const active = focused && (i === value.length || (i === length - 1 && value.length === length));
          return (
            <View
              key={i}
              style={{
                flex: 1,
                maxWidth: 52,
                height: 56,
                borderRadius: radius.md,
                borderWidth: active || error ? 1.5 : 1,
                borderColor: error ? c.danger.base : active ? c.primary.base : c.borderStrong,
                backgroundColor: c.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TextInput
                editable={false}
                pointerEvents="none"
                value={char}
                style={{ fontFamily: fonts.heading, fontSize: 24, color: c.text, padding: 0, textAlign: 'center' }}
              />
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={t => {
          const digits = t.replace(/\D/g, '').slice(0, length);
          onChange(digits);
          if (digits.length === length) onComplete?.(digits);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        accessibilityLabel={`${length}-digit verification code`}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
    </Pressable>
  );
}
