/**
 * Secure Clipboard Service with automatic expiration (SCRUM-139 / P1-02).
 *
 * Copies TOTP codes or secrets to the system clipboard and schedules an
 * automatic wipe after a configured TTL (default 30 seconds). Only wipes
 * if the clipboard still contains the exact value copied by this app.
 */

let clipboardModule: any = null;
let clipboardLoaded = false;

async function getClipboardModule() {
  if (clipboardLoaded) return clipboardModule;
  try {
    clipboardModule = await import('expo-clipboard');
  } catch {
    clipboardModule = null;
  } finally {
    clipboardLoaded = true;
  }
  return clipboardModule;
}

export class ClipboardService {
  private static activeTimer: ReturnType<typeof setTimeout> | null = null;
  private static lastCopiedText: string | null = null;
  private static memoryClipboard = ''; // In-memory fallback for test environments
  private static customClipboard: any = null;

  constructor(customAdapter?: any) {
    if (customAdapter) {
      ClipboardService.customClipboard = customAdapter;
    }
  }

  static setCustomClipboard(clipboard: any): void {
    this.customClipboard = clipboard;
  }

  /**
   * Sets clipboard content with an automatic expiration wipe timer
   */
  static async copyWithExpiration(text: string, ttlSeconds = 30): Promise<void> {
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }

    this.lastCopiedText = text;
    const mod = this.customClipboard || (await getClipboardModule());
    if (mod && typeof mod.setStringAsync === 'function') {
      await mod.setStringAsync(text);
    } else {
      this.memoryClipboard = text;
    }

    if (ttlSeconds > 0) {
      this.activeTimer = setTimeout(async () => {
        await this.clearIfOwned(text);
      }, ttlSeconds * 1000);

      if (typeof (this.activeTimer as any)?.unref === 'function') {
        (this.activeTimer as any).unref();
      }
    }
  }

  /**
   * Clears the clipboard ONLY if it still holds the exact value written by this app
   */
  static async clearIfOwned(expectedText: string): Promise<boolean> {
    const mod = this.customClipboard || (await getClipboardModule());
    let current = '';
    if (mod && typeof mod.getStringAsync === 'function') {
      try {
        current = await mod.getStringAsync();
      } catch {
        current = '';
      }
    } else {
      current = this.memoryClipboard;
    }

    if (current === expectedText) {
      if (mod && typeof mod.setStringAsync === 'function') {
        try {
          await mod.setStringAsync('');
        } catch {
          // ignore
        }
      } else {
        this.memoryClipboard = '';
      }
      if (this.lastCopiedText === expectedText) {
        this.lastCopiedText = null;
      }
      return true;
    }

    return false;
  }

  /**
   * Manual immediate clipboard wipe
   */
  static async clear(): Promise<void> {
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    this.lastCopiedText = null;
    const mod = this.customClipboard || (await getClipboardModule());
    if (mod && typeof mod.setStringAsync === 'function') {
      try {
        await mod.setStringAsync('');
      } catch {
        // ignore
      }
    } else {
      this.memoryClipboard = '';
    }
  }

  /**
   * Current text for testing
   */
  static async getCurrentText(): Promise<string> {
    const mod = this.customClipboard || (await getClipboardModule());
    if (mod && typeof mod.getStringAsync === 'function') {
      try {
        return await mod.getStringAsync();
      } catch {
        return '';
      }
    }
    return this.memoryClipboard;
  }

  async copyWithExpiration(text: string, ttlSeconds = 30): Promise<void> {
    return ClipboardService.copyWithExpiration(text, ttlSeconds);
  }

  async clearIfOwned(expectedText: string): Promise<boolean> {
    return ClipboardService.clearIfOwned(expectedText);
  }

  async clear(): Promise<void> {
    return ClipboardService.clear();
  }

  async getCurrentText(): Promise<string> {
    return ClipboardService.getCurrentText();
  }
}

export const clipboardService = new ClipboardService();
export default clipboardService;
