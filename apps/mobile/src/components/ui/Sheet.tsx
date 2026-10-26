import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { Easing, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from '@tamagui/lucide-icons';
import { useAppColors } from '../../context/ThemeContext';
import { motion, radius, space } from '../../theme/tokens';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Pinned under the scrollable content (primary actions). */
  footer?: React.ReactNode;
  /** Don't wrap children in a ScrollView (they scroll themselves). */
  noScroll?: boolean;
}

/** Bottom sheet built on Modal: dimmed backdrop, spring slide-in, tap-outside to close. */
export function Sheet({ visible, onClose, title, subtitle, children, footer, noScroll }: SheetProps) {
  const c = useAppColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.overlay }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <Animated.View
          entering={SlideInDown.duration(motion.slow).easing(Easing.out(Easing.cubic))}
          accessibilityViewIsModal
          style={{
            maxHeight: '88%',
            backgroundColor: c.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: Math.max(insets.bottom, space.md),
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.borderStrong }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm }}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="headline" accessibilityRole="header">{title}</AppText>
              {subtitle ? <AppText variant="caption" tone="muted">{subtitle}</AppText> : null}
            </View>
            <IconButton icon={X} label="Close" onPress={onClose} size={36} />
          </View>
          {noScroll ? (
            <View style={{ paddingHorizontal: space.lg, flexShrink: 1 }}>{children}</View>
          ) : (
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          )}
          {footer ? (
            <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.xs, borderTopWidth: 1, borderTopColor: c.border }}>
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
