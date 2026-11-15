export type DeviceSizeTier = 'compact' | 'regular' | 'large' | 'tablet';

export interface ResponsiveMetricsInput {
  width: number;
  height: number;
  fontScale?: number;
  topInset?: number;
  bottomInset?: number;
  platformOS?: 'ios' | 'android' | 'web' | 'macos' | 'windows' | string;
}

export interface TabBarLayoutMetrics {
  height: number;
  paddingTop: number;
  paddingBottom: number;
  labelFontSize: number;
  iconSize: number;
  authenticatorLabel: string;
}

export interface OtpDigitMetrics {
  boxWidth: number;
  boxHeight: number;
  fontSize: number;
  gap: number;
}

export interface ResponsiveLayoutMetrics {
  width: number;
  height: number;
  fontScale: number;
  tier: DeviceSizeTier;
  isCompact: boolean;
  isRegular: boolean;
  isLarge: boolean;
  isTablet: boolean;
  isShortScreen: boolean;
  isLandscape: boolean;
  horizontalPadding: number;
  verticalPadding: number;
  cardPadding: number;
  cardGap: number;
  contentMaxWidth: number | undefined;
  authCardMaxWidth: number;
  modalMaxWidth: number;
  modalMaxHeight: number;
  headerTitleSize: number;
  subtitleSize: number;
  stackActionButtons: boolean;
  gridColumns: number;
  scrollBottomPadding: number;
  tabBar: TabBarLayoutMetrics;
}

/**
 * Classifies the logical viewport width into responsive device tiers.
 */
export function classifyDeviceSize(width: number): DeviceSizeTier {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 375;
  if (safeWidth < 360) return 'compact';
  if (safeWidth < 415) return 'regular';
  if (safeWidth < 600) return 'large';
  return 'tablet';
}

/**
 * Pure computation of responsive spacing, typography, modal sizing, and safe tab-bar metrics.
 * Kept React-Native-free so unit tests can verify calculations directly under Node.
 */
export function computeResponsiveMetrics(
  input: ResponsiveMetricsInput,
): ResponsiveLayoutMetrics {
  const width = Math.max(280, Number.isFinite(input.width) ? input.width : 375);
  const height = Math.max(480, Number.isFinite(input.height) ? input.height : 812);
  const fontScale =
    Number.isFinite(input.fontScale) && (input.fontScale ?? 1) > 0
      ? (input.fontScale as number)
      : 1;
  const bottomInset = Math.max(0, Number.isFinite(input.bottomInset) ? (input.bottomInset as number) : 0);
  const platformOS = input.platformOS ?? 'android';

  const tier = classifyDeviceSize(width);
  const isCompact = tier === 'compact';
  const isRegular = tier === 'regular';
  const isLarge = tier === 'large';
  const isTablet = tier === 'tablet';
  const isShortScreen = height < 700;
  const isLandscape = width > height;

  const horizontalPadding =
    tier === 'compact' ? 12 : tier === 'regular' ? 14 : tier === 'large' ? 18 : 24;
  const verticalPadding = isCompact || isShortScreen ? 10 : 14;
  const cardPadding = isCompact ? 12 : isRegular ? 14 : 18;
  const cardGap = isCompact ? 10 : 12;

  const contentMaxWidth = isTablet ? Math.min(680, width - horizontalPadding * 2) : undefined;
  const authCardMaxWidth = isTablet ? 460 : Math.min(440, width - horizontalPadding * 2);
  const modalMaxWidth = isTablet ? 520 : Math.max(280, width - (isCompact ? 20 : 32));
  const modalMaxHeight = Math.max(380, Math.round(height * 0.88));

  const headerTitleSize = isCompact ? 19 : isRegular ? 21 : isTablet ? 24 : 22;
  const subtitleSize = isCompact ? 12 : 13;

  // Side-by-side dashboard CTA buttons at >= 360dp unless OS accessibility scale is very large
  const stackActionButtons = width < 360 || (width < 400 && fontScale > 1.25);
  const gridColumns = width >= 600 ? 2 : 1;

  const minTabBottom = platformOS === 'ios' ? 6 : 8;
  const tabBottomPadding = Math.max(bottomInset, minTabBottom);
  const baseBarHeight = isCompact ? 54 : 56;
  const tabBar: TabBarLayoutMetrics = {
    height: baseBarHeight + tabBottomPadding,
    paddingTop: 6,
    paddingBottom: tabBottomPadding,
    labelFontSize: isCompact || fontScale > 1.15 ? 10 : 11,
    iconSize: isCompact ? 20 : 22,
    authenticatorLabel: isCompact ? '2FA' : '2FA Vault',
  };

  // Fixed web tab overlay sits above content so web needs bottom clearance; native <Tabs> sizes scene above bar
  const scrollBottomPadding =
    platformOS === 'web'
      ? Math.max(84, tabBar.height + 24)
      : 20 + Math.max(0, Math.round(bottomInset * 0.25));

  return {
    width,
    height,
    fontScale,
    tier,
    isCompact,
    isRegular,
    isLarge,
    isTablet,
    isShortScreen,
    isLandscape,
    horizontalPadding,
    verticalPadding,
    cardPadding,
    cardGap,
    contentMaxWidth,
    authCardMaxWidth,
    modalMaxWidth,
    modalMaxHeight,
    headerTitleSize,
    subtitleSize,
    stackActionButtons,
    gridColumns,
    scrollBottomPadding,
    tabBar,
  };
}

/**
 * Calculates digit box width/height/gap so 6-digit TOTP and 8-digit Email OTP
 * never clip horizontally on narrow 320dp-360dp phones.
 */
export function computeOtpDigitMetrics(
  viewportWidth: number,
  codeLength: number,
  cardHorizontalPadding = 32,
  screenHorizontalPadding = 28,
): OtpDigitMetrics {
  const safeCount = codeLength >= 8 ? 8 : 6;
  const hasSeparator = safeCount === 8;
  const available = Math.max(220, Math.min(viewportWidth, 440) - cardHorizontalPadding - screenHorizontalPadding);
  const gap = viewportWidth < 360 ? 4 : safeCount === 8 ? 5 : 8;
  const separatorReserve = hasSeparator ? 14 : 0;
  const totalGaps = gap * (safeCount - 1) + separatorReserve;
  const maxBox = safeCount === 8 ? 38 : 46;
  const rawWidth = Math.floor((available - totalGaps) / safeCount);
  const boxWidth = Math.max(26, Math.min(maxBox, rawWidth));
  const boxHeight = Math.round(boxWidth * (safeCount === 8 ? 1.3 : 1.22));
  const fontSize = boxWidth <= 30 ? 16 : boxWidth <= 36 ? 18 : 21;

  return { boxWidth, boxHeight, fontSize, gap };
}
