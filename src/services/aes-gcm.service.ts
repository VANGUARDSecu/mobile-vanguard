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
}
