export type MobileChecklistCategory =
  | 'biometrics'
  | 'totp'
  | 'push_mfa'
  | 'sso'
  | 'governance';

export type MobileGuideAction =
  | 'navigate_vault'
  | 'navigate_settings'
  | 'open_push_sandbox'
  | 'navigate_apps'
  | 'request_app';

export interface MobileChecklistItem {
  id: string;
  title: string;
  description: string;
  category: MobileChecklistCategory;
  targetAction: MobileGuideAction;
  actionLabel: string;
  badge: string;
  completed: boolean;
}

export interface MobileGuideSlide {
  stepNumber: number;
  title: string;
  subtitle: string;
  icon: string;
  summary: string;
  keyPoints: string[];
  recommendedAction?: {
    label: string;
    targetAction: MobileGuideAction;
  };
}
