import type { EncryptedVaultEnvelope } from '../models/vault.models.ts';

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
    const key = await globalThis.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const raw = await globalThis.crypto.subtle.exportKey('raw', key);
    return uint8ArrayToBase64(new Uint8Array(raw));
  }

  /**
   * Encrypts plaintext data with AES-GCM using a 256-bit master key and random 96-bit IV
   */
  static async encrypt(
    plaintext: string,
    keyBase64: string
  ): Promise<EncryptedVaultEnvelope> {
    const rawKey = base64ToUint8Array(keyBase64);
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      rawKey as unknown as BufferSource,
      'AES-GCM',
      false,
      ['encrypt']
    );

    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(plaintext);

    const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      cryptoKey,
      encodedData as unknown as BufferSource
    );

    const encryptedBytes = new Uint8Array(encryptedBuffer);

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
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      rawKey as unknown as BufferSource,
      'AES-GCM',
      false,
      ['decrypt']
    );

    const iv = base64ToUint8Array(envelope.iv);
    const ciphertext = base64ToUint8Array(envelope.ciphertext);

    const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      cryptoKey,
      ciphertext as unknown as BufferSource
    );

    return new TextDecoder().decode(decryptedBuffer);
  }

  /**
   * Derives a 256-bit AES-GCM CryptoKey from a passphrase and salt using PBKDF2-SHA256
   */
  static async deriveKeyFromPassword(
    passphrase: string,
    salt: Uint8Array,
    iterations = 100000
  ): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
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

  /**
   * Password-based encryption for secure exports (PBKDF2-SHA256 + AES-GCM-256)
   */
  static async encryptWithPassword(
    plaintext: string,
    passphrase: string,
    iterations = 100000
  ): Promise<{ salt: string; iv: string; ciphertext: string; iterations: number }> {
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKeyFromPassword(passphrase, salt, iterations);
    const encoded = new TextEncoder().encode(plaintext);

    const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      encoded as unknown as BufferSource
    );

    return {
      salt: uint8ArrayToBase64(salt),
      iv: uint8ArrayToBase64(iv),
      ciphertext: uint8ArrayToBase64(new Uint8Array(encryptedBuffer)),
      iterations,
    };
  }

  /**
   * Password-based decryption for secure imports (PBKDF2-SHA256 + AES-GCM-256)
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
    const key = await this.deriveKeyFromPassword(passphrase, salt, iterations);

    const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );

    return new TextDecoder().decode(decryptedBuffer);
  }
}
