/**
 * Vanguard Cyber Dark Theme Design Tokens
 * Replicating Vanguard's desktop design system for mobile (React Native / Expo)
 */

export const CyberColors = {
  // Base Backgrounds
  background: '#0a0e17',
  cardBg: '#0f172a',
  cardBgSecondary: '#131d31',
  cardBgHover: '#1e293b',
  cardBgGlass: 'rgba(15, 23, 42, 0.75)',
  modalBackdrop: 'rgba(5, 8, 16, 0.85)',

  // Borders
  border: '#1e293b',
  borderSubtle: '#172554',
  borderGlass: 'rgba(30, 41, 59, 0.8)',
  borderHighlight: '#00e5ff',
  borderGreen: '#10b981',
  borderIndigo: '#6366f1',
  borderAmber: '#f59e0b',
  borderDanger: '#ef4444',

  // Primary Cyber Accents
  cyan: '#00e5ff',
  cyanGlow: 'rgba(0, 229, 255, 0.15)',
  cyanLight: '#e0f7fa',
  cyanMuted: 'rgba(0, 229, 255, 0.3)',

  // Semantic Status Colors
  green: '#10b981',
  greenGlow: 'rgba(16, 185, 129, 0.15)',
  indigo: '#6366f1',
  indigoGlow: 'rgba(99, 102, 241, 0.15)',
  amber: '#f59e0b',
  amberGlow: 'rgba(245, 158, 11, 0.15)',
  red: '#ef4444',
  redGlow: 'rgba(239, 68, 68, 0.15)',

  // Typography
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  textDark: '#0a0e17',
} as const;

export const CyberRadius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
} as const;

export const CyberGlass = {
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
  },
  cardHighlight: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderColor: 'rgba(0, 229, 255, 0.35)',
    borderWidth: 1,
    borderRadius: CyberRadius.md,
  },
  modal: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1,
    borderRadius: CyberRadius.lg,
  },
} as const;

export const CyberShadows = {
  cyanGlow: {
    shadowColor: CyberColors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  greenGlow: {
    shadowColor: CyberColors.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  indigoGlow: {
    shadowColor: CyberColors.indigo,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
} as const;

