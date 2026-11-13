export type AuthenticatorSubScreen =
  | 'vault'
  | 'account-detail'
  | 'add-account'
  | 'security-settings'
  | 'push-harness';

const AUTH_ROUTES = new Set(['/login', '/register', '/verify-otp']);

function normalizePathname(pathname: string): string {
  const trimmed = (pathname || '').trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Resolves whether the root router should redirect based on authentication state
 * and current pathname. Returns the target route or null if no redirect is needed.
 */
export function resolveAuthRedirectPath(
  isAuthenticated: boolean,
  pathname: string
): '/login' | '/' | null {
  const normalized = normalizePathname(pathname);
  const isAuthRoute = AUTH_ROUTES.has(normalized);

  if (!isAuthenticated) {
    return isAuthRoute ? null : '/login';
  }

  return isAuthRoute ? '/' : null;
}

/**
 * Maps nested screens inside AuthenticatorNavigator to their logical parent when
 * the hardware back button is pressed. Returns null at the root 'vault' screen.
 */
export function getAuthenticatorBackScreen(
  currentScreen: AuthenticatorSubScreen
): AuthenticatorSubScreen | null {
  if (currentScreen === 'push-harness') {
    return 'security-settings';
  }
  if (currentScreen === 'vault') {
    return null;
  }
  return 'vault';
}
