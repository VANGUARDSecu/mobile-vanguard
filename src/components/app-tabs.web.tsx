import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { usePathname } from 'expo-router';
import { Pressable, View, Text, StyleSheet } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { CyberColors, CyberRadius } from '@/constants/cyber-theme';
import { MaxContentWidth } from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { shouldHideAppTabBar } from '@/utils/navigation-guard';

export default function AppTabs() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const hideTabBar = shouldHideAppTabBar(isAuthenticated, pathname);

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList hidden={hideTabBar}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon="📱">Apps</TabButton>
          </TabTrigger>
          <TabTrigger name="vault" href="/vault" asChild>
            <TabButton icon="🔑">Vault</TabButton>
          </TabTrigger>
          <TabTrigger name="devices" href="/devices" asChild>
            <TabButton icon="💻">Devices</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton icon="🛡️">Security</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  icon,
  ...props
}: TabTriggerSlotProps & { icon?: string }) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.tabButtonView,
          isFocused ? styles.tabButtonViewActive : styles.tabButtonViewInactive,
        ]}>
        {icon ? <Text style={styles.tabIcon}>{icon}</Text> : null}
        <Text
          style={[
            styles.tabButtonText,
            isFocused ? styles.tabButtonTextActive : styles.tabButtonTextInactive,
          ]}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

export function CustomTabList({
  hidden,
  ...props
}: TabListProps & { hidden?: boolean }) {
  const responsive = useResponsiveLayout();
  const showBrand = responsive.width >= 640;

  if (hidden) {
    return <View {...props} style={{ display: 'none' }} />;
  }
  return (
    <View
      {...props}
      style={[
        styles.tabListContainer,
        {
          paddingHorizontal: responsive.isCompact ? 8 : 16,
          paddingVertical: responsive.isCompact ? 6 : 10,
        },
      ]}>
      <View
        style={[
          styles.innerContainer,
          !showBrand && styles.innerContainerCompact,
        ]}>
        {showBrand ? (
          <View style={styles.brandWrap}>
            <Text style={styles.brandShield}>🛡️</Text>
            <Text style={styles.brandText}>VANGUARD</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>ZERO-TRUST</Text>
            </View>
          </View>
        ) : null}

        <View
          style={[
            styles.tabsWrap,
            !showBrand && styles.tabsWrapCompact,
          ]}>
          {props.children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'fixed' as any,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    zIndex: 90,
    backgroundColor: 'rgba(10, 14, 23, 0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(30, 41, 59, 0.8)',
    pointerEvents: 'box-none' as any,
  },
  innerContainer: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: CyberRadius.full,
    backgroundColor: CyberColors.cardBg,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: MaxContentWidth,
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  innerContainerCompact: {
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandShield: {
    fontSize: 14,
  },
  brandText: {
    color: CyberColors.cyan,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: CyberRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
    marginLeft: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: CyberColors.green,
  },
  statusText: {
    color: CyberColors.green,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tabsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabsWrapCompact: {
    flex: 1,
    justifyContent: 'space-around',
    gap: 4,
  },
  tabButtonView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: CyberRadius.full,
    cursor: 'pointer' as any,
  },
  tabButtonViewActive: {
    backgroundColor: CyberColors.cyanGlow,
    borderColor: CyberColors.cyan,
    borderWidth: 1,
  },
  tabButtonViewInactive: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderColor: 'transparent',
    borderWidth: 1,
  },
  tabIcon: {
    fontSize: 12,
  },
  tabButtonText: {
    fontSize: 12,
  },
  tabButtonTextActive: {
    color: CyberColors.cyan,
    fontWeight: '800',
  },
  tabButtonTextInactive: {
    color: CyberColors.textSecondary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});
