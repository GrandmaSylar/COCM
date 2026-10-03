import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeOutUp } from 'react-native-reanimated';
import { enterFromTop } from '../../theme/animations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, Info, XCircle } from '@tamagui/lucide-icons';
import { useAppColors } from '../../context/ThemeContext';
import { motion, radius, space } from '../../theme/tokens';
import { haptic } from '../../theme/haptics';
import { AppText } from './AppText';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  title: string;
  message?: string;
  tone?: ToastTone;
  /** ms; default 3000 (errors 4500). */
  duration?: number;
}

interface ToastState extends Required<Pick<ToastOptions, 'title' | 'tone'>> {
  id: number;
  message?: string;
}

const ToastContext = createContext<{ show: (opts: ToastOptions) => void }>({ show: () => {} });

/**
 * Non-blocking confirmations. Use for success/info; keep native alerts for
 * destructive confirmations and anything the user must acknowledge.
 */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const show = useCallback(({ title, message, tone = 'success', duration }: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    const id = ++counter.current;
    setToast({ id, title, message, tone });
    if (tone === 'success') haptic.success();
    else if (tone === 'error') haptic.error();
    else if (tone === 'warning') haptic.warning();
    timer.current = setTimeout(() => setToast(t => (t?.id === id ? null : t)), duration ?? (tone === 'error' ? 4500 : 3000));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDismiss={() => setToast(null)} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  const c = useAppColors();
  const insets = useSafeAreaInsets();
  const toneMap = {
    success: { color: c.success.text, icon: CheckCircle2 },
    error: { color: c.danger.text, icon: XCircle },
    warning: { color: c.warning.text, icon: AlertTriangle },
    info: { color: c.info.text, icon: Info },
  }[toast.tone];
  const Icon = toneMap.icon;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: space.md, right: space.md }}>
      <Animated.View
        // Subtle: short fade + small drop at the top edge, no spring
        entering={enterFromTop()}
        exiting={FadeOutUp.duration(motion.fast)}
      >
        <Pressable
          onPress={onDismiss}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={toast.message ? `${toast.title}. ${toast.message}` : toast.title}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            padding: 14,
            borderRadius: radius.lg,
            backgroundColor: c.isDark ? c.surfaceMuted : c.surface,
            borderWidth: 1,
            borderColor: c.border,
            shadowColor: '#000',
            shadowOpacity: c.isDark ? 0.4 : 0.12,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
          <Icon size={20} color={toneMap.color} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{toast.title}</AppText>
            {toast.message ? <AppText variant="caption" tone="muted">{toast.message}</AppText> : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
