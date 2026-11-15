import { AesGcmService } from './aes-gcm.service.ts';
import { AppsStorageService } from './apps-storage.service.ts';
import { isLiveBackendToken } from './totp-sync.service.ts';
import type { PersonalVaultItem } from '../models/apps.models.ts';

export const VAULT_PBKDF2_ITERATIONS = 600_000;

export interface RemoteVaultEnvelope {
  version: string;
  cipher: 'AES-GCM-256' | string;
  kdf?: {
    name?: string;
    hash?: string;
    iterations?: number;
  };
  salt: string;
  iv: string;
  ciphertext: string;
  updatedAt?: string;
}

export interface CredentialVaultSnapshot {
  unlocked: boolean;
  hasRemoteEnvelope: boolean;
  revision: number;
  lastUpdatedAt: string | null;
  items: PersonalVaultItem[];
}

export type CredentialVaultListener = (snapshot: CredentialVaultSnapshot) => void;

function normalizeVaultItems(raw: unknown): PersonalVaultItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, any> => Boolean(entry && typeof entry === 'object'))
    .map((it) => ({
      id: String(it.id || `vault-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      userId: it.userId ? String(it.userId) : undefined,
      title: String(it.title || 'Saved Login'),
      category:
        it.category === 'Card' ||
        it.category === 'Identity' ||
        it.category === 'Secure Note' ||
        it.category === 'Login'
          ? it.category
          : 'Login',
      username: String(it.username || ''),
      password: typeof it.password === 'string' ? it.password : undefined,
      totpSecret: typeof it.totpSecret === 'string' ? it.totpSecret : undefined,
      url: typeof it.url === 'string' ? it.url : undefined,
      notes: typeof it.notes === 'string' ? it.notes : undefined,
      favorite: Boolean(it.favorite),
      updatedAt: String(it.updatedAt || 'Synced'),
    }));
}

/**
 * Zero-knowledge Credential Vault sync (/vault) compatible 1:1 with
 * frontend-vanguard VaultCryptoService and extension-vanguard.
 * Never writes plaintext credentials or passphrases to disk.
 */
export class CredentialVaultSyncService {
  private unlocked = false;
  private hasRemoteEnvelope = false;
  private revision = 0;
  private lastUpdatedAt: string | null = null;
  private items: PersonalVaultItem[] = [];
  private sessionPassphrase: string | null = null;
  private readonly listeners = new Set<CredentialVaultListener>();

  getSnapshot(): CredentialVaultSnapshot {
    return {
      unlocked: this.unlocked,
      hasRemoteEnvelope: this.hasRemoteEnvelope,
      revision: this.revision,
      lastUpdatedAt: this.lastUpdatedAt,
      items: this.items.map((item) => ({ ...item })),
    };
  }

  subscribe(listener: CredentialVaultListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snap = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snap);
    }
  }

  /** Store clean login password in RAM only so /vault can auto-unlock cleanly. */
  setSessionPassphrase(passphrase: string | null): void {
    this.sessionPassphrase = passphrase && passphrase.trim().length > 0 ? passphrase : null;
  }

  hasSessionPassphrase(): boolean {
    return Boolean(this.sessionPassphrase);
  }

  lock(): void {
    this.unlocked = false;
    this.sessionPassphrase = null;
    this.items = [];
    this.notify();
  }

  resetSession(): void {
    this.unlocked = false;
    this.hasRemoteEnvelope = false;
    this.revision = 0;
    this.lastUpdatedAt = null;
    this.sessionPassphrase = null;
    this.items = [];
    this.notify();
  }

  async fetchRemoteEnvelope(token?: string | null): Promise<{
    ok: boolean;
    envelope: RemoteVaultEnvelope | null;
    revision: number;
  }> {
    if (!isLiveBackendToken(token)) {
      return { ok: false, envelope: null, revision: this.revision };
    }
    try {
      const baseUrl = AppsStorageService.getBackendApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      const response = await fetch(`${baseUrl}/vault`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        return { ok: false, envelope: null, revision: this.revision };
      }
      const data = (await response.json()) as {
        envelope?: RemoteVaultEnvelope | null;
        revision?: number;
      };
      const envelope = data?.envelope ?? null;
      const revision = typeof data?.revision === 'number' ? data.revision : 0;
      this.hasRemoteEnvelope = Boolean(envelope);
      this.revision = revision;
      this.lastUpdatedAt = envelope?.updatedAt || this.lastUpdatedAt;
      this.notify();
      return { ok: true, envelope, revision };
    } catch {
      return { ok: false, envelope: null, revision: this.revision };
    }
  }

  async decryptEnvelope(
    envelope: RemoteVaultEnvelope,
    passphrase: string,
  ): Promise<PersonalVaultItem[]> {
    const iterations = envelope.kdf?.iterations || VAULT_PBKDF2_ITERATIONS;
    const plaintext = await AesGcmService.decryptWithPassword(
      envelope.ciphertext,
      envelope.iv,
      envelope.salt,
      passphrase,
      iterations,
    );
    return normalizeVaultItems(JSON.parse(plaintext));
  }

  async encryptItems(
    items: PersonalVaultItem[],
    passphrase: string,
    iterations = VAULT_PBKDF2_ITERATIONS,
  ): Promise<RemoteVaultEnvelope> {
    const encrypted = await AesGcmService.encryptWithPassword(
      JSON.stringify(items),
      passphrase,
      iterations,
    );
    return {
      version: 'v1',
      cipher: 'AES-GCM-256',
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: encrypted.iterations,
      },
      salt: encrypted.salt,
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
      updatedAt: new Date().toISOString(),
    };
  }

  async unlockWithPassword(
    passphrase: string,
    token?: string | null,
  ): Promise<PersonalVaultItem[]> {
    const cleanPass = passphrase;
    if (!cleanPass) {
      throw new Error('Vault password is required to unlock your saved credentials.');
    }

    const remote = await this.fetchRemoteEnvelope(token);
    if (remote.ok && remote.envelope) {
      try {
        const decrypted = await this.decryptEnvelope(remote.envelope, cleanPass);
        this.items = decrypted;
        this.revision = remote.revision;
        this.hasRemoteEnvelope = true;
        this.lastUpdatedAt = remote.envelope.updatedAt || new Date().toISOString();
      } catch {
        throw new Error('Incorrect vault password. Could not decrypt your synchronized credentials.');
      }
    } else if (remote.ok && !remote.envelope) {
      this.items = [];
      this.hasRemoteEnvelope = false;
      this.revision = 0;
    }

    this.sessionPassphrase = cleanPass;
    this.unlocked = true;
    this.notify();
    return this.getSnapshot().items;
  }

  async tryAutoUnlock(token?: string | null): Promise<boolean> {
    if (!this.sessionPassphrase || !isLiveBackendToken(token)) {
      const remote = await this.fetchRemoteEnvelope(token);
      return Boolean(remote.ok && !remote.envelope && this.unlocked);
    }
    try {
      await this.unlockWithPassword(this.sessionPassphrase, token);
      return true;
    } catch {
      return false;
    }
  }

  async syncIfUnlocked(token?: string | null): Promise<void> {
    if (!isLiveBackendToken(token)) return;
    const prevRevision = this.revision;
    const prevUpdatedAt = this.lastUpdatedAt;
    const remote = await this.fetchRemoteEnvelope(token);
    if (!remote.ok) return;

    if (!remote.envelope) {
      if (this.unlocked) {
        this.items = [];
        this.notify();
      }
      return;
    }

    const changed =
      remote.revision !== prevRevision ||
      (remote.envelope.updatedAt || null) !== prevUpdatedAt ||
      (this.unlocked && this.items.length === 0);

    if (changed && this.unlocked && this.sessionPassphrase) {
      try {
        this.items = await this.decryptEnvelope(remote.envelope, this.sessionPassphrase);
        this.revision = remote.revision;
        this.lastUpdatedAt = remote.envelope.updatedAt || this.lastUpdatedAt;
        this.notify();
      } catch {
        // Keep unlocked state intact if envelope key differs until user unlocks manually
      }
    }
  }

  async persistItems(
    nextItems: PersonalVaultItem[],
    token?: string | null,
  ): Promise<PersonalVaultItem[]> {
    if (!this.unlocked || !this.sessionPassphrase) {
      throw new Error('Unlock your Password Vault before saving credentials.');
    }

    const normalized = normalizeVaultItems(nextItems);
    this.items = normalized;
    this.notify();

    if (!isLiveBackendToken(token)) {
      return normalized;
    }

    const envelope = await this.encryptItems(normalized, this.sessionPassphrase);
    const baseUrl = AppsStorageService.getBackendApiUrl();

    const pushEnvelope = async (expectedRevision: number) => {
      const response = await fetch(`${baseUrl}/vault`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...envelope,
          expectedRevision,
        }),
      });
      return response;
    };

    let res = await pushEnvelope(this.revision);
    if (res.status === 409) {
      // Refresh revision once and retry optimistic write cleanly
      const latest = await this.fetchRemoteEnvelope(token);
      if (latest.ok) {
        res = await pushEnvelope(latest.revision);
      }
    }

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(errData?.message || `Failed to save encrypted vault (${res.status})`);
    }

    const saved = (await res.json().catch(() => ({}))) as {
      revision?: number;
      updatedAt?: string;
    };
    this.hasRemoteEnvelope = true;
    this.revision = typeof saved?.revision === 'number' ? saved.revision : this.revision + 1;
    this.lastUpdatedAt = saved?.updatedAt || envelope.updatedAt || new Date().toISOString();
    this.notify();
    return normalized;
  }

  async upsertItem(
    input: {
      id?: string;
      title: string;
      category?: PersonalVaultItem['category'];
      username: string;
      password?: string;
      url?: string;
      notes?: string;
      favorite?: boolean;
    },
    token?: string | null,
  ): Promise<PersonalVaultItem[]> {
    const nowIso = new Date().toISOString();
    const normTitle = input.title.trim().toLowerCase();
    const normUser = input.username.trim().toLowerCase();

    const next = [...this.items];
    const existingIdx = next.findIndex(
      (i) =>
        (input.id && i.id === input.id) ||
        (i.title.trim().toLowerCase() === normTitle &&
          i.username.trim().toLowerCase() === normUser),
    );

    const record: PersonalVaultItem = {
      id: input.id || (existingIdx >= 0 ? next[existingIdx].id : `vault-item-${Date.now()}`),
      title: input.title.trim() || 'Saved Login',
      category: input.category || 'Login',
      username: input.username.trim(),
      password: input.password,
      url: input.url?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      favorite: Boolean(input.favorite),
      updatedAt: nowIso,
    };

    if (existingIdx >= 0) {
      next[existingIdx] = record;
    } else {
      next.unshift(record);
    }

    return this.persistItems(next, token);
  }

  async deleteItem(id: string, token?: string | null): Promise<PersonalVaultItem[]> {
    const next = this.items.filter((item) => item.id !== id);
    return this.persistItems(next, token);
  }
}

export const credentialVaultSyncService = new CredentialVaultSyncService();
