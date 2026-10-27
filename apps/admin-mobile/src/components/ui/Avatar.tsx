import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { useAppColors } from '../../context/ThemeContext';
import { AppText } from './AppText';

export function initialsOf(name?: string | null) {
  return (name || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
}

export interface AvatarProps {
  name?: string | null;
  /** Local cached path or remote URL; falls back to initials when missing or broken. */
  uri?: string | null;
  size?: number;
}

/** Rounded-square avatar: photo when available, otherwise initials on a tinted well. */
export function Avatar({ name, uri, size = 44 }: AvatarProps) {
  const c = useAppColors();
  const [failed, setFailed] = useState(false);
  const r = Math.round(size * 0.32);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
        style={{ width: size, height: size, borderRadius: r, backgroundColor: c.surfaceMuted }}
      />
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: size, height: size, borderRadius: r, backgroundColor: c.primary.soft, alignItems: 'center', justifyContent: 'center' }}
    >
      <AppText
        variant={size >= 64 ? 'title' : 'bodyStrong'}
        tone="primary"
        style={size >= 64 ? { fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.44) } : undefined}
      >
        {initialsOf(name)}
      </AppText>
    </View>
  );
}
