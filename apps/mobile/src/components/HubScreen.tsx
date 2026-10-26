import React from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAppColors } from '../context/ThemeContext';
import { useAccess } from '../lib/access';
import { enterUp } from '../theme/animations';
import { space } from '../theme/tokens';
import { AppText, ListRow, Section } from './ui';

type IconType = React.ComponentType<{ size?: number; color?: string }>;

export interface HubItem {
  title: string;
  description: string;
  icon: IconType;
  route: string;
  /** Live figure shown on the right, e.g. "214". */
  value?: string;
}

interface HubScreenProps {
  title: string;
  subtitle: string;
  items: HubItem[];
  /** Optional block under the title (e.g. a summary). */
  header?: React.ReactNode;
}

/** Shared layout for the People / Operations tab hubs. */
export function HubScreen({ title, subtitle, items, header }: HubScreenProps) {
  const router = useRouter();
  const c = useAppColors();
  const { canRoute } = useAccess();
  const visible = items.filter(i => canRoute(i.route));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: space.md, paddingBottom: space.xxl, gap: space.xl }}
    >
      <Animated.View entering={enterUp()} style={{ gap: 4 }}>
        <AppText variant="display" accessibilityRole="header">{title}</AppText>
        <AppText variant="body" tone="muted">{subtitle}</AppText>
      </Animated.View>

      {header ? <Animated.View entering={enterUp(40)}>{header}</Animated.View> : null}

      <Animated.View entering={enterUp(80)}>
        <Section>
          {visible.map(item => (
            <ListRow
              key={item.route}
              icon={item.icon}
              title={item.title}
              subtitle={item.description}
              value={item.value}
              onPress={() => router.push(item.route as any)}
              chevron
            />
          ))}
        </Section>
        {visible.length === 0 ? (
          <View style={{ paddingTop: space.md }}>
            <AppText variant="caption" tone="muted" align="center">
              You don't have access to any modules here. Ask an administrator to grant access.
            </AppText>
          </View>
        ) : null}
      </Animated.View>
    </ScrollView>
  );
}
