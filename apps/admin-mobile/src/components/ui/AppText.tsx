import React from 'react';
import { Text, TextProps } from 'react-native';
import { useAppColors } from '../../context/ThemeContext';
import { fonts, typeScale } from '../../theme/tokens';

export type TextVariant =
  | 'display' | 'title' | 'headline'
  | 'body' | 'bodyMedium' | 'bodyStrong'
  | 'caption' | 'captionStrong'
  | 'micro' | 'label';

export type TextTone =
  | 'default' | 'muted' | 'subtle'
  | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  | 'onPrimary';

// fontFamily carries the weight; never combine it with fontWeight (Android
// falls back to the system font when both are set on a custom family).
const VARIANTS: Record<TextVariant, { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing?: number }> = {
  display: { ...typeScale.display, fontFamily: fonts.headingStrong, letterSpacing: -0.6 },
  title: { ...typeScale.title, fontFamily: fonts.heading, letterSpacing: -0.3 },
  headline: { ...typeScale.headline, fontFamily: fonts.heading, letterSpacing: -0.2 },
  body: { ...typeScale.body, fontFamily: fonts.body },
  bodyMedium: { ...typeScale.body, fontFamily: fonts.bodyMedium },
  bodyStrong: { ...typeScale.body, fontFamily: fonts.bodySemiBold },
  caption: { ...typeScale.caption, fontFamily: fonts.body },
  captionStrong: { ...typeScale.caption, fontFamily: fonts.bodySemiBold },
  micro: { ...typeScale.micro, fontFamily: fonts.bodySemiBold, letterSpacing: 0.2 },
  label: { ...typeScale.caption, fontFamily: fonts.bodySemiBold, letterSpacing: 0.1 },
};

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  /** Overrides `tone`. */
  color?: string;
  /** Tabular figures for amounts and counts. */
  numeric?: boolean;
  align?: 'left' | 'center' | 'right';
}

export function AppText({
  variant = 'body',
  tone = 'default',
  color,
  numeric,
  align,
  style,
  ...rest
}: AppTextProps) {
  const c = useAppColors();
  const toneColor: Record<TextTone, string> = {
    default: c.text,
    muted: c.textMuted,
    subtle: c.textSubtle,
    primary: c.primary.text,
    success: c.success.text,
    warning: c.warning.text,
    danger: c.danger.text,
    info: c.info.text,
    onPrimary: c.primary.on,
  };

  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        VARIANTS[variant],
        { color: color ?? toneColor[tone] },
        numeric ? { fontVariant: ['tabular-nums'] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
