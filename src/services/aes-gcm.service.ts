import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import type { EncryptedVaultEnvelope } from '../models/vault.models.ts';

function encodeUtf8(value: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value);
  }
  const encoded = unescape(encodeURIComponent(value));
  const out = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    out[i] = encoded.charCodeAt(i);
  }
  return out;
}

function decodeUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return decodeURIComponent(escape(binary));
}

function hasSubtleCrypto(): boolean {
  return Boolean(
    typeof globalThis.crypto?.subtle?.importKey === 'function' &&
      typeof globalThis.crypto?.subtle?.encrypt === 'function' &&
      typeof globalThis.crypto?.subtle?.decrypt === 'function' &&
      typeof globalThis.crypto?.subtle?.deriveKey === 'function',
  );
}

/**
 * Generates cryptographically strong random bytes using WebCrypto when available
 * or expo-crypto on React Native Hermes runtimes where globalThis.crypto is absent.
 */
async function getSecureRandomBytes(byteCount: number): Promise<Uint8Array> {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    return globalThis.crypto.getRandomValues(new Uint8Array(byteCount));
  }

  try {
    const expoCrypto = await import('expo-crypto');
    if (typeof expoCrypto?.getRandomBytesAsync === 'function') {
      return await expoCrypto.getRandomBytesAsync(byteCount);
    }
    if (typeof expoCrypto?.getRandomBytes === 'function') {
      return expoCrypto.getRandomBytes(byteCount);
    }
  } catch {
    // Fall through to explicit error below if native module is unavailable
  }

  throw new Error('Cryptographically secure random byte generator is unavailable on this runtime.');
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = globalThis.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class AesGcmService {
  /**
   * Generates a 256-bit AES-GCM hardware/software master key
   */
  static async generateMasterKey(): Promise<string> {
    if (typeof globalThis.crypto?.subtle?.generateKey === 'function' && typeof globalThis.crypto?.subtle?.exportKey === 'function') {
      const key = await globalThis.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const raw = await globalThis.crypto.subtle.exportKey('raw', key);
      return uint8ArrayToBase64(new Uint8Array(raw));
    }

    const rawBytes = await getSecureRandomBytes(32);
    return uint8ArrayToBase64(rawBytes);
  }

  /**
   * Encrypts plaintext data with AES-GCM using a 256-bit master key and random 96-bit IV.
   * Uses WebCrypto SubtleCrypto on Web/Node and pure-JS NIST AES-GCM (@noble/ciphers) on Hermes native.
   */
  static async encrypt(
    plaintext: string,
    keyBase64: string
  ): Promise<EncryptedVaultEnvelope> {
    const rawKey = base64ToUint8Array(keyBase64);
    const iv = await getSecureRandomBytes(12);
    const encodedData = encodeUtf8(plaintext);

    let encryptedBytes: Uint8Array;
    if (hasSubtleCrypto()) {
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        rawKey as unknown as BufferSource,
        'AES-GCM',
        false,
        ['encrypt']
      );

      const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        cryptoKey,
        encodedData as unknown as BufferSource
      );

      encryptedBytes = new Uint8Array(encryptedBuffer);
    } else {
      encryptedBytes = gcm(rawKey, iv).encrypt(encodedData);
    }

    return {
      version: '1.0.0',
      cipher: 'AES-GCM-256',
      iv: uint8ArrayToBase64(iv),
      ciphertext: uint8ArrayToBase64(encryptedBytes),
      tag: 'AES-GCM-AUTH-TAG-VERIFIED',
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Decrypts an AES-GCM encrypted envelope using the master key
   */
  static async decrypt(
    envelope: EncryptedVaultEnvelope,
    keyBase64: string
  ): Promise<string> {
    const rawKey = base64ToUint8Array(keyBase64);
    const iv = base64ToUint8Array(envelope.iv);
    const ciphertext = base64ToUint8Array(envelope.ciphertext);

    if (hasSubtleCrypto()) {
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        rawKey as unknown as BufferSource,
        'AES-GCM',
        false,
        ['decrypt']
      );

      const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        cryptoKey,
        ciphertext as unknown as BufferSource
      );

      return decodeUtf8(new Uint8Array(decryptedBuffer));
    }

    const decryptedBytes = gcm(rawKey, iv).decrypt(ciphertext);
    return decodeUtf8(decryptedBytes);
  }

  /**
   * Derives a 256-bit AES-GCM CryptoKey from a passphrase and salt using PBKDF2-SHA256
   */
  static async deriveKeyFromPassword(
    passphrase: string,
    salt: Uint8Array,
    iterations = 100000
  ): Promise<CryptoKey> {
    const keyMaterial = await globalThis.crypto.subtle.importKey(
      'raw',
      encodeUtf8(passphrase) as unknown as BufferSource,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return globalThis.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as unknown as BufferSource,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private static async deriveRawKeyFromPassword(
    passphrase: string,
    salt: Uint8Array,
    iterations = 100000
  ): Promise<Uint8Array> {
    return pbkdf2Async(sha256, encodeUtf8(passphrase), salt, {
      c: iterations,
      dkLen: 32,
      asyncTick: 10,
    });
  }

  /**
   * Password-based encryption for secure exports and cross-platform Password Vault sync (PBKDF2-SHA256 + AES-GCM-256)
   */
  static async encryptWithPassword(
    plaintext: string,
    passphrase: string,
    iterations = 100000
  ): Promise<{ salt: string; iv: string; ciphertext: string; iterations: number }> {
    const salt = await getSecureRandomBytes(16);
    const iv = await getSecureRandomBytes(12);
    const encoded = encodeUtf8(plaintext);

    let encryptedBytes: Uint8Array;
    if (hasSubtleCrypto()) {
      const key = await this.deriveKeyFromPassword(passphrase, salt, iterations);
      const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        key,
        encoded as unknown as BufferSource
      );
      encryptedBytes = new Uint8Array(encryptedBuffer);
    } else {
      const rawKey = await this.deriveRawKeyFromPassword(passphrase, salt, iterations);
      encryptedBytes = gcm(rawKey, iv).encrypt(encoded);
    }

    return {
      salt: uint8ArrayToBase64(salt),
      iv: uint8ArrayToBase64(iv),
      ciphertext: uint8ArrayToBase64(encryptedBytes),
      iterations,
    };
  }

  /**
   * Password-based decryption for secure imports and cross-platform Password Vault sync (PBKDF2-SHA256 + AES-GCM-256)
   */
  static async decryptWithPassword(
    ciphertextBase64: string,
    ivBase64: string,
    saltBase64: string,
    passphrase: string,
    iterations = 100000
  ): Promise<string> {
    const salt = base64ToUint8Array(saltBase64);
    const iv = base64ToUint8Array(ivBase64);
    const ciphertext = base64ToUint8Array(ciphertextBase64);

    if (hasSubtleCrypto()) {
      const key = await this.deriveKeyFromPassword(passphrase, salt, iterations);
      const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        key,
        ciphertext as unknown as BufferSource
      );
      return decodeUtf8(new Uint8Array(decryptedBuffer));
    }

    const rawKey = await this.deriveRawKeyFromPassword(passphrase, salt, iterations);
    const decryptedBytes = gcm(rawKey, iv).decrypt(ciphertext);
    return decodeUtf8(decryptedBytes);
  }
}
