import React from 'react';
import { StatusBar } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useAppColors } from '../../context/ThemeContext';

interface ScreenProps {
  children: React.ReactNode;
  /**
   * Safe-area edges this screen pads itself. Screens that render <AppHeader>
   * leave out 'top' (the header handles it).
   */
  edges?: Edge[];
  /** 'surface' for screens that are one big card (forms, receipts). */
  tone?: 'background' | 'surface';
}

/** Root wrapper for every screen: themed background (never hard-coded black) + safe areas. */
export function Screen({ children, edges = ['left', 'right'], tone = 'background' }: ScreenProps) {
  const colors = useAppColors();
  const backgroundColor = tone === 'surface' ? colors.surface : colors.background;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={edges}>
      <StatusBar
        barStyle={colors.isDark ? 'light-content' : 'dark-content'}
        animated
      />
      {children}
    </SafeAreaView>
  );
}
