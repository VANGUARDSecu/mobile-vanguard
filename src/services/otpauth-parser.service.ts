/**
 * RFC 6238 / KeyUriFormat otpauth:// URI Parser (SCRUM-139 / P1-02).
 *
 * Implements genuine standard parsing of otpauth://totp/ URIs extracted from
 * QR codes or manual entry. Validates Base32 secrets, algorithm, digits, and period.
 */

import { TotpEngine } from './totp-engine.service.ts';
import type { TotpAlgorithm } from '../models/vault.models.ts';

export interface ParsedOtpAuthUri {
  type: 'totp';
  accountName: string;
  issuer: string;
  secret: string;
  algorithm: TotpAlgorithm;
  digits: number;
  period: number;
}

export class OtpAuthParser {
  /**
   * Parses and validates an otpauth://totp/ URI
   */
  static parse(uri: string): ParsedOtpAuthUri {
    if (!uri || typeof uri !== 'string') {
      throw new Error('OTPAUTH_INVALID_URI: URI string is required.');
    }

    const trimmed = uri.trim();
    if (!trimmed.toLowerCase().startsWith('otpauth://')) {
      throw new Error('OTPAUTH_INVALID_SCHEME: URI must begin with "otpauth://".');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmed);
    } catch {
      throw new Error('OTPAUTH_MALFORMED: Failed to parse URL.');
    }

    const type = parsedUrl.hostname.toLowerCase() || parsedUrl.pathname.split('/')[1]?.toLowerCase();
    if (type !== 'totp') {
      throw new Error(`OTPAUTH_UNSUPPORTED_TYPE: Only "totp" is supported, received "${type}".`);
    }

    // Label is in the pathname (e.g. /Vanguard:user@domain.com or /user@domain.com)
    let rawLabel = parsedUrl.pathname.replace(/^\/+/, '');
    // If parsedUrl.hostname was "totp", pathname is "/Label"
    if (parsedUrl.hostname.toLowerCase() === 'totp') {
      rawLabel = parsedUrl.pathname.replace(/^\/+/, '');
    } else if (rawLabel.toLowerCase().startsWith('totp/')) {
      rawLabel = rawLabel.slice(5);
    }

    let decodedLabel = '';
    try {
      decodedLabel = decodeURIComponent(rawLabel);
    } catch {
      decodedLabel = rawLabel;
    }

    const searchParams = parsedUrl.searchParams;
    let issuerParam = searchParams.get('issuer')?.trim() || '';
    let accountName = decodedLabel;

    // Check if label contains "Issuer:Account"
    if (decodedLabel.includes(':')) {
      const parts = decodedLabel.split(':');
      const labelIssuer = parts[0].trim();
      const labelAccount = parts.slice(1).join(':').trim();
      if (!issuerParam && labelIssuer) {
        issuerParam = labelIssuer;
      }
      accountName = labelAccount || decodedLabel;
    }

    const issuer = issuerParam || 'Vanguard Security';

    // Secret parameter
    const secretParam = searchParams.get('secret');
    if (!secretParam) {
      throw new Error('OTPAUTH_MISSING_SECRET: "secret" parameter is required.');
    }

    const cleanSecret = TotpEngine.cleanSecret(secretParam);
    if (!TotpEngine.isValidBase32(cleanSecret)) {
      throw new Error('OTPAUTH_INVALID_SECRET: Secret is not a valid Base32 string.');
    }

    // Algorithm (SHA1, SHA256, SHA512)
    let algorithm: TotpAlgorithm = 'SHA1';
    const algoParam = searchParams.get('algorithm')?.toUpperCase();
    if (algoParam) {
      if (algoParam === 'SHA1' || algoParam === 'SHA256' || algoParam === 'SHA512') {
        algorithm = algoParam;
      } else {
        throw new Error(`OTPAUTH_UNSUPPORTED_ALGORITHM: Unsupported algorithm "${algoParam}".`);
      }
    }

    // Digits (6 or 8)
    let digits = 6;
    const digitsParam = searchParams.get('digits');
    if (digitsParam) {
      const d = parseInt(digitsParam, 10);
      if (d === 6 || d === 8) {
        digits = d;
      } else {
        throw new Error(`OTPAUTH_INVALID_DIGITS: Digits must be 6 or 8, received "${digitsParam}".`);
      }
    }

    // Period (default 30)
    let period = 30;
    const periodParam = searchParams.get('period');
    if (periodParam) {
      const p = parseInt(periodParam, 10);
      if (!isNaN(p) && p > 0) {
        period = p;
      } else {
        throw new Error(`OTPAUTH_INVALID_PERIOD: Period must be a positive number, received "${periodParam}".`);
      }
    }

    return {
      type: 'totp',
      accountName: accountName || 'Unknown Account',
      issuer,
      secret: cleanSecret,
      algorithm,
      digits,
      period,
    };
  }
}
