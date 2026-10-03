import { Easing, FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { motion } from './tokens';

/**
 * Shared entrance animations: short, eased, small offsets, never springy.
 * Reanimated naming: FadeInDown rises from below, FadeInUp drops from above.
 */
const ease = Easing.out(Easing.cubic);

/** Content settling into place (rises a few px). */
export const enterUp = (delay = 0) =>
  FadeInDown.duration(motion.base)
    .easing(ease)
    .withInitialValues({ opacity: 0, transform: [{ translateY: motion.enterOffset }] })
    .delay(delay);

/** Top-anchored elements like toasts (drops a few px). */
export const enterFromTop = () =>
  FadeInUp.duration(motion.base)
    .easing(ease)
    .withInitialValues({ opacity: 0, transform: [{ translateY: -motion.enterOffset }] });

/** Plain fade (lists, section switches). */
export const fadeIn = (delay = 0) => FadeIn.duration(motion.base).easing(ease).delay(delay);
