// Design tokens live in @cms/shared (shared with the admin apps). Only the
// React Native font family names stay here.
export {
  HIT,
  buildAppColors,
  motion,
  neutrals,
  radius,
  space,
  typeScale,
} from '@cms/shared';
export type { AppColors, ToneColors } from '@cms/shared';

export const fonts = {
  heading: 'PlusJakartaSans_700Bold',
  headingStrong: 'PlusJakartaSans_800ExtraBold',
  headingMedium: 'PlusJakartaSans_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;
