export interface ParsedDevicePairingQr {
  pairingKey: string;
  pairingToken?: string;
  email?: string;
  issuer?: string;
}

const PAIRING_KEY_REGEX = /^VG-[A-Z0-9]{4,}-[A-Z0-9]{4,}$/i;

function normalizePairingKey(rawKey: unknown): string | null {
  if (typeof rawKey !== 'string') {
    return null;
  }
  const normalized = rawKey.trim().toUpperCase();
  return PAIRING_KEY_REGEX.test(normalized) ? normalized : null;
}

/**
 * Parses a scanned device pairing QR payload from the Vanguard Web Dashboard.
 * Supports JSON payloads (`{"pairingKey", "pairingToken", "email", "issuer"}`),
 * `vanguard-enroll://` URLs, or direct `VG-XXXX-XXXX` pairing keys.
 */
export function parseDevicePairingQrPayload(raw: string): ParsedDevicePairingQr {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    throw new Error('Scanned QR payload is empty.');
  }

  if (trimmed.toLowerCase().startsWith('otpauth://')) {
    throw new Error(
      'This is an authenticator TOTP QR code. Add it from the Vault tab instead of Device Pairing.'
    );
  }

  if (trimmed.startsWith('{')) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      throw new Error('Invalid JSON in scanned device pairing QR code.');
    }

    const pairingKey = normalizePairingKey(parsed.pairingKey ?? parsed.key);
    if (!pairingKey) {
      throw new Error('Invalid device pairing QR payload: missing pairingKey.');
    }

    return {
      pairingKey,
      pairingToken:
        typeof parsed.pairingToken === 'string'
          ? parsed.pairingToken
          : typeof parsed.token === 'string'
          ? parsed.token
          : undefined,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      issuer: typeof parsed.issuer === 'string' ? parsed.issuer : undefined,
    };
  }

  if (trimmed.toLowerCase().startsWith('vanguard-enroll://')) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new Error('Invalid vanguard-enroll QR URI.');
    }

    const pairingKey = normalizePairingKey(
      url.searchParams.get('key') ?? url.searchParams.get('pairingKey')
    );
    if (!pairingKey) {
      throw new Error('Invalid vanguard-enroll QR URI: missing pairing key.');
    }

    return {
      pairingKey,
      pairingToken:
        url.searchParams.get('token') ??
        url.searchParams.get('pairingToken') ??
        undefined,
      email: url.searchParams.get('email') ?? undefined,
      issuer: url.searchParams.get('issuer') ?? undefined,
    };
  }

  const directKey = normalizePairingKey(trimmed);
  if (!directKey) {
    throw new Error(
      'Invalid device pairing QR code. Expected a Vanguard pairing key (VG-XXXX-XXXX).'
    );
  }

  return { pairingKey: directKey };
}
