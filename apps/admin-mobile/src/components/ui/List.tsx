import React from 'react';
import { View, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useAppColors } from '../../context/ThemeContext';
import { radius, space } from '../../theme/tokens';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { Tone, useToneColors } from './Badge';

type IconType = React.ComponentType<{ size?: number; color?: string }>;

/** Plain grouped surface (no shadow). */
export function Surface({ children, style, padded = true }: { children: React.ReactNode; style?: ViewStyle; padded?: boolean }) {
  const c = useAppColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.border,
          overflow: 'hidden',
        },
        padded ? { padding: space.md } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface SectionProps {
  title?: string;
  /** Right side of the title line (e.g. a small button). */
  action?: React.ReactNode;
  /** Help text under the group. */
  footer?: string;
  children: React.ReactNode;
  /** Render children directly instead of in a grouped surface. */
  bare?: boolean;
}

/** A titled group of rows with hairline dividers between them. */
export function Section({ title, action, footer, children, bare }: SectionProps) {
  const c = useAppColors();
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={{ gap: space.xs }}>
      {title || action ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, minHeight: 28 }}>
          {title ? <AppText variant="captionStrong" tone="muted">{title}</AppText> : <View />}
          {action}
        </View>
      ) : null}
      {bare ? (
        children
      ) : (
        <Surface padded={false}>
          {items.map((child, i) => (
            <View key={i}>
              {i > 0 ? <View style={{ height: 1, backgroundColor: c.border, marginLeft: space.md }} /> : null}
              {child}
            </View>
          ))}
        </Surface>
      )}
      {footer ? (
        <AppText variant="caption" tone="subtle" style={{ paddingHorizontal: 4 }}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

/** Rounded square holding an icon, tinted by tone. */
export function IconWell({ icon: Icon, tone = 'primary', size = 36 }: { icon: IconType; tone?: Tone; size?: number }) {
  const t = useToneColors(tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        backgroundColor: t.soft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={Math.round(size * 0.5)} color={t.text} />
    </View>
  );
}

export interface DetailRowProps {
  label: string;
  value?: React.ReactNode;
  /** Shown when value is empty. */
  fallback?: string;
  valueTone?: 'default' | 'primary' | 'success' | 'danger';
  onPress?: () => void;
}

/** Read-only "label — value" line for profile and detail screens. */
export function DetailRow({ label, value, fallback = 'Not recorded', valueTone = 'default', onPress }: DetailRowProps) {
  const empty = value === undefined || value === null || value === '';
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 12, minHeight: 48 }}>
      <AppText variant="caption" tone="muted" style={{ flex: 1, paddingTop: 1 }}>{label}</AppText>
      {typeof value === 'string' || typeof value === 'number' || empty ? (
        <AppText
          variant="bodyMedium"
          tone={empty ? 'subtle' : onPress ? 'primary' : valueTone}
          style={{ flex: 1.4, textAlign: 'right' }}
          selectable={!onPress}
        >
          {empty ? fallback : String(value)}
        </AppText>
      ) : (
        <View style={{ flex: 1.4, alignItems: 'flex-end' }}>{value}</View>
      )}
    </View>
  );
  if (!onPress || empty) return body;
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={`${label}: ${String(value)}`}>
      {body}
    </PressableScale>
  );
}

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconType;
  iconTone?: Tone;
  /** Short value shown on the right (e.g. a count). */
  value?: string;
  /** Custom right-side content (switch, badge, buttons). */
  right?: React.ReactNode;
  onPress?: () => void;
  /** Defaults to true when the row is pressable and has no custom `right`. */
  chevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  /** Extra content under the title block (e.g. action buttons). */
  children?: React.ReactNode;
  accessibilityLabel?: string;
}

export function ListRow({
  title,
  subtitle,
  icon,
  iconTone = 'primary',
  value,
  right,
  onPress,
  chevron,
  destructive,
  disabled,
  children,
  accessibilityLabel,
}: ListRowProps) {
  const c = useAppColors();
  const showChevron = chevron ?? (!!onPress && !right);

  const content = (
    <View style={{ paddingHorizontal: space.md, paddingVertical: 12, minHeight: 56, gap: 10, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {icon ? <IconWell icon={icon} tone={destructive ? 'danger' : iconTone} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyMedium" tone={destructive ? 'danger' : 'default'} numberOfLines={2}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" tone="muted" numberOfLines={3}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {value ? (
          <AppText variant="body" tone="muted" numeric>
            {value}
          </AppText>
        ) : null}
        {right}
        {showChevron ? <ChevronRight size={18} color={c.textSubtle} /> : null}
      </View>
      {children}
    </View>
  );

  if (!onPress) return content;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
    >
      {content}
    </PressableScale>
  );
}
