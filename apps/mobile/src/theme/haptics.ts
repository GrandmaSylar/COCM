import * as Haptics from 'expo-haptics';

/** Fire-and-forget haptics; silently ignored where unsupported (web, some Androids). */
export const haptic = {
  /** Button / row press. */
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  /** Primary or significant action. */
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  /** Chip, segment, toggle or picker change. */
  selection: () => Haptics.selectionAsync().catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
