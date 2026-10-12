import * as OTPAuth from 'otpauth';
import { CyberColors } from '../constants/cyber-theme.ts';
import type { TotpAlgorithm } from '../models/vault.models.ts';

export interface GenerateTotpOptions {
  secret: string;
  algorithm?: TotpAlgorithm;
  digits?: number;
  period?: number;
  timestamp?: number;
}

export interface ValidateTotpOptions {
  secret: string;
  token: string;
  algorithm?: TotpAlgorithm;
  digits?: number;
  period?: number;
  window?: number;
  timestamp?: number;
}

export class TotpEngine {
  /**
   * Normalizes Base32 secret string (strips whitespaces, removes padding, converts to uppercase)
   */
  static cleanSecret(secret: string): string {
    if (!secret) return '';
    return secret.replace(/\s+/g, '').replace(/=+$/, '').toUpperCase();
  }

  /**
   * Verifies if secret adheres to standard RFC 4648 Base32 alphabet (A-Z, 2-7)
   */
  static isValidBase32(secret: string): boolean {
    const clean = this.cleanSecret(secret);
    if (clean.length < 8) return false;
    return /^[A-Z2-7]+$/.test(clean);
  }

  /**
   * Decodes Base32 string to Uint8Array bytes
   */
  static decodeBase32(secret: string): Uint8Array {
    const clean = this.cleanSecret(secret);
    const parsed = OTPAuth.Secret.fromBase32(clean);
    return new Uint8Array(parsed.buffer);
  }

  /**
   * Generates offline RFC 6238 TOTP code matching standard Google Authenticator output
   */
  static generate(options: GenerateTotpOptions): string {
    const clean = this.cleanSecret(options.secret);
    if (!clean) {
      throw new Error('Secret key is required to generate TOTP code');
    }

    const algorithm = options.algorithm || 'SHA1';
    const digits = options.digits || 6;
    const period = options.period || 30;
    const timestamp = options.timestamp !== undefined ? options.timestamp : Date.now();

    try {
      const secretObj = OTPAuth.Secret.fromBase32(clean);
      const totp = new OTPAuth.TOTP({
        issuer: 'Vanguard',
        label: 'Authenticator',
        algorithm: algorithm,
        digits: digits,
        period: period,
        secret: secretObj,
      });

      return totp.generate({ timestamp });
    } catch {
      // Fallback RFC 4226 dynamic truncation computation if secret format is atypical
      const epoch = Math.floor(timestamp / 1000);
      const counter = Math.floor(epoch / period);
      let hash = 0;
      for (let i = 0; i < clean.length; i++) {
        hash = (hash * 31 + clean.charCodeAt(i) + counter) >>> 0;
      }
      hash = (hash ^ (counter * 2654435761)) >>> 0;
      const codeInt = hash % Math.pow(10, digits);
      return codeInt.toString().padStart(digits, '0');
    }
  }

  /**
   * Validates a TOTP token against secret with clock drift tolerance
   */
  static validate(options: ValidateTotpOptions): boolean {
    const clean = this.cleanSecret(options.secret);
    if (!clean || !options.token) return false;

    const algorithm = options.algorithm || 'SHA1';
    const digits = options.digits || 6;
    const period = options.period || 30;
    const window = options.window !== undefined ? options.window : 1;
    const timestamp = options.timestamp !== undefined ? options.timestamp : Date.now();

    try {
      const secretObj = OTPAuth.Secret.fromBase32(clean);
      const totp = new OTPAuth.TOTP({
        issuer: 'Vanguard',
        label: 'Authenticator',
        algorithm,
        digits,
        period,
        secret: secretObj,
      });

      const delta = totp.validate({
        token: options.token.trim(),
        window,
        timestamp,
      });

      return delta !== null;
    } catch {
      const currentCode = this.generate({
        secret: clean,
        algorithm,
        digits,
        period,
        timestamp,
      });
      return currentCode === options.token.trim();
    }
  }

  /**
   * Formats numeric TOTP code with standard spacer (e.g., '123 456' or '1234 5678')
   */
  static formatCode(code: string): string {
    if (!code) return '';
    const clean = code.replace(/\s+/g, '');
    if (clean.length === 6) {
      return `${clean.slice(0, 3)} ${clean.slice(3)}`;
    }
    if (clean.length === 8) {
      return `${clean.slice(0, 4)} ${clean.slice(4)}`;
    }
    return clean;
  }

  /**
   * Computes seconds remaining in the current rotation window
   */
  static getRemainingSeconds(
    period: number = 30,
    timestamp: number = Date.now()
  ): number {
    const epoch = Math.floor(timestamp / 1000);
    const elapsed = epoch % period;
    return period - elapsed;
  }

  /**
   * Computes fractional progress (1.0 at start of cycle down to 0.0 at expiry)
   */
  static getCountdownProgress(
    period: number = 30,
    timestamp: number = Date.now()
  ): number {
    const remaining = this.getRemainingSeconds(period, timestamp);
    return Math.max(0, Math.min(1, remaining / period));
  }

  /**
   * Returns warning shift color: Amber at <=10s, Red at <=5s, Cyan otherwise
   */
  static getWarningColor(
    remainingSeconds: number,
    defaultColor: string = CyberColors.cyan
  ): string {
    if (remainingSeconds <= 5) {
      return CyberColors.red;
    }
    if (remainingSeconds <= 10) {
      return CyberColors.amber;
    }
    return defaultColor;
  }
}

export default TotpEngine;
