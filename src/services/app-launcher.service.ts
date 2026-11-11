import { CyberColors } from '../constants/cyber-theme.ts';
import type {
  SaaSApp,
  UserConnectedApp,
  AppAccessRequest,
  PersonalVaultItem,
} from '../models/apps.models.ts';

export class AppLauncherService {
  /**
   * Normalizes URLs to ensure a proper http/https protocol prefix
   */
  static normalizeUrl(url: string): string {
    if (!url) return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  }

  /**
   * Displays alert feedback safely across native and web environments
   */
  private static async showAlert(title: string, message: string): Promise<void> {
    try {
      const rn = await import('react-native');
      rn.Alert?.alert?.(title, message);
    } catch {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`${title}\n\n${message}`);
      }
    }
  }

  /**
   * Opens a URL in the secure in-app browser or native external handler
   */
  static async openUrl(url: string): Promise<boolean> {
    let targetUrl = this.normalizeUrl(url);
    if (!targetUrl) {
      await this.showAlert('Unable to Launch', 'No valid target URL was provided.');
      return false;
    }

    try {
      const { Platform } = await import('react-native');
      if (
        Platform?.OS === 'android' &&
        (targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1'))
      ) {
        const { AppsStorageService } = await import('./apps-storage.service.ts');
        const hostIp = AppsStorageService.getLocalhostIp();
        targetUrl = targetUrl.replace(/localhost|127\.0\.0\.1/g, hostIp);
      }
    } catch {
      // Non-blocking URL adaptation fallback
    }

    try {
      const WebBrowser = await import('expo-web-browser');
      if (WebBrowser && typeof WebBrowser.openBrowserAsync === 'function') {
        await WebBrowser.openBrowserAsync(targetUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle?.FULL_SCREEN,
          toolbarColor: CyberColors.background,
        });
        return true;
      }
    } catch {
      // Browser fallback to linking
    }

    try {
      const Linking = await import('expo-linking');
      if (Linking && typeof Linking.openURL === 'function') {
        await Linking.openURL(targetUrl);
        return true;
      }
    } catch {
      // Fallback
    }

    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(targetUrl, '_blank');
      return true;
    }

    await this.showAlert('Launch Error', `Could not open target address: ${targetUrl}`);
    return false;
  }

  /**
   * Launches a SaaS application
   */
  static async launchApp(app: SaaSApp): Promise<boolean> {
    if (!app.launchUrl) {
      await this.showAlert('Unable to Launch', `No launch URL configured for ${app.name}.`);
      return false;
    }

    return this.openUrl(app.launchUrl);
  }

  /**
   * Launches an external SSO connected client (e.g. Acme Dummy Web)
   */
  static async launchConnectedApp(app: UserConnectedApp): Promise<boolean> {
    const targetUrl = app.originUrl || app.redirectUri;
    if (!targetUrl) {
      await this.showAlert(
        'Unable to Launch',
        `No target origin URL configured for connected client: ${app.clientName}.`
      );
      return false;
    }

    return this.openUrl(targetUrl);
  }

  /**
   * Launches an approved governance request
   */
  static async launchApprovedRequest(
    req: AppAccessRequest,
    enterpriseApps: SaaSApp[] = []
  ): Promise<boolean> {
    const matchingApp = enterpriseApps.find(
      (a) => a.name.toLowerCase() === req.appName.toLowerCase()
    );
    const targetUrl =
      matchingApp?.launchUrl || req.launchUrl || 'https://vanguard.security';

    return this.openUrl(targetUrl);
  }

  /**
   * Matches personal vault credentials against target application URL/domain
   */
  static findMatchingVaultCredentials(
    domainOrUrl: string,
    vault: PersonalVaultItem[]
  ): PersonalVaultItem[] {
    if (!domainOrUrl || !vault || vault.length === 0) {
      return [];
    }

    const cleanTarget = domainOrUrl
      .toLowerCase()
      .trim()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .split('/')[0]
      .split('?')[0];

    if (!cleanTarget) return [];

    return vault.filter((item) => {
      const itemUrl = (item.url || '')
        .toLowerCase()
        .trim()
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .split('/')[0]
        .split('?')[0];

      const itemTitle = item.title.toLowerCase();
      return (
        (itemUrl && itemUrl.includes(cleanTarget)) ||
        (itemUrl && cleanTarget.includes(itemUrl)) ||
        itemTitle.includes(cleanTarget)
      );
    });
  }
}
