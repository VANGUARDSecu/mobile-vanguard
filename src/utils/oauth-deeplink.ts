export interface OAuthAuthorizeDeepLinkParams {
  client_id: string;
  client_name?: string;
  redirect_uri: string;
  response_type: string;
  scope: string;
  state?: string;
  nonce?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  login_hint?: string;
  prompt?: string;
}

const DEFAULT_VANGUARD_PORTAL_URL = 'https://vanguard-security.pages.dev';
const SUPPORTED_SCHEMES = new Set(['vanguard-auth:', 'mobilevanguard:', 'https:', 'http:']);
const UNSAFE_REDIRECT_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'file:']);

/**
 * Parses an incoming OIDC authorization deep link (`vanguard-auth://oauth/authorize?...`
 * or `mobilevanguard://oauth/authorize?...`) launched by a relying party mobile app.
 */
export function parseOAuthAuthorizeDeepLink(rawUrl: string): OAuthAuthorizeDeepLinkParams | null {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(rawUrl.trim());
    if (!SUPPORTED_SCHEMES.has(parsed.protocol.toLowerCase())) {
      return null;
    }

    // For custom URL schemes (`vanguard-auth://oauth/authorize`), `oauth` is parsed as `hostname`
    // and `/authorize` as `pathname`. Also support `/oauth/authorize` paths.
    const combinedRoute = `${parsed.hostname}${parsed.pathname}`.replace(/^\/+/, '').toLowerCase();
    if (combinedRoute !== 'oauth/authorize') {
      return null;
    }

    const clientId = parsed.searchParams.get('client_id')?.trim();
    const redirectUri = parsed.searchParams.get('redirect_uri')?.trim();
    if (!clientId || !redirectUri) {
      return null;
    }

    try {
      const redirectUrl = new URL(redirectUri);
      if (UNSAFE_REDIRECT_PROTOCOLS.has(redirectUrl.protocol.toLowerCase())) {
        return null;
      }
    } catch {
      return null;
    }

    const opt = (key: string): string | undefined => {
      const val = parsed.searchParams.get(key)?.trim();
      return val ? val : undefined;
    };

    return {
      client_id: clientId,
      client_name: opt('client_name'),
      redirect_uri: redirectUri,
      response_type: opt('response_type') ?? 'code',
      scope: opt('scope') ?? 'openid profile email',
      state: opt('state'),
      nonce: opt('nonce'),
      code_challenge: opt('code_challenge'),
      code_challenge_method: opt('code_challenge_method'),
      login_hint: opt('login_hint'),
      prompt: opt('prompt'),
    };
  } catch {
    return null;
  }
}

/**
 * Builds an RFC 6749 error callback URL so the calling app returns cleanly on denial.
 */
export function buildOAuthErrorRedirect(
  redirectUri: string,
  error: string,
  errorDescription?: string,
  state?: string,
): string {
  try {
    const url = new URL(redirectUri);
    url.searchParams.set('error', error);
    if (errorDescription) {
      url.searchParams.set('error_description', errorDescription);
    }
    if (state) {
      url.searchParams.set('state', state);
    }
    return url.toString();
  } catch {
    const sep = redirectUri.includes('?') ? '&' : '?';
    const qs = new URLSearchParams({ error });
    if (errorDescription) qs.set('error_description', errorDescription);
    if (state) qs.set('state', state);
    return `${redirectUri}${sep}${qs.toString()}`;
  }
}

/**
 * Builds the fallback Vanguard web login portal URL (`vanguard-security.pages.dev/login`)
 * preserving all OAuth/OIDC PKCE query parameters.
 */
export function buildWebPortalAuthorizeUrl(
  params: OAuthAuthorizeDeepLinkParams,
  portalBaseUrl = DEFAULT_VANGUARD_PORTAL_URL,
): string {
  const normalizedBase = (portalBaseUrl || DEFAULT_VANGUARD_PORTAL_URL).trim().replace(/\/+$/, '');
  const query = new URLSearchParams({
    client_id: params.client_id,
    redirect_uri: params.redirect_uri,
    response_type: params.response_type || 'code',
    scope: params.scope || 'openid profile email',
  });
  if (params.client_name) query.set('client_name', params.client_name);
  if (params.state) query.set('state', params.state);
  if (params.nonce) query.set('nonce', params.nonce);
  if (params.code_challenge) query.set('code_challenge', params.code_challenge);
  if (params.code_challenge_method) query.set('code_challenge_method', params.code_challenge_method);
  if (params.login_hint) query.set('login_hint', params.login_hint);
  if (params.prompt) query.set('prompt', params.prompt);
  return `${normalizedBase}/login?${query.toString()}`;
}

const ALLOWED_MOBILE_SSO_RETURN_SCHEMES = ['vanguard-dummy://', 'exp://'];

/**
 * Checks whether an OIDC approval redirect URL uses a supported custom mobile scheme.
 */
export function isCustomMobileSsoCallbackUrl(
  url: string | null | undefined,
): url is string {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return ALLOWED_MOBILE_SSO_RETURN_SCHEMES.some((prefix) =>
    trimmed.startsWith(prefix),
  );
}

/**
 * Checks whether an incoming URL is an out-of-band push MFA challenge deep link.
 */
export function isPushChallengeDeepLink(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('mfa/challenge') || url.includes('challenge');
}
