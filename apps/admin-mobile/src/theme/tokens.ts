// Design tokens live in @cms/shared (shared with the Expo app and the web admin).
// Only the React Native font family names are defined here.
export { HIT, buildAppColors, motion, neutrals, radius, space, typeScale } from '@cms/shared/design';
export type { AppColors, ToneColors } from '@cms/shared/design';

export const fonts = {
  heading: 'PlusJakartaSans_700Bold',
  headingStrong: 'PlusJakartaSans_800ExtraBold',
  headingMedium: 'PlusJakartaSans_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;
