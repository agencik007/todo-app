import { Injectable, signal } from '@angular/core';

/**
 * The number of open tasks on the installed app's icon (App Badging API:
 * Chromium on desktop, Safari on macOS and iOS). Off by default; the user
 * turns it on in the settings. Chrome exposes the API in a plain tab too,
 * where it does nothing, so the setting is offered only inside the installed
 * app.
 */
@Injectable({
  providedIn: 'root',
})
export class AppBadgeService {
  static readonly STORAGE_KEY = 'app_badge_enabled';

  readonly supported =
    typeof navigator !== 'undefined' && 'setAppBadge' in navigator;

  /** True when the badge can be seen: the API exists and this is the app. */
  readonly available = this.supported && isInstalledApp();

  readonly #enabled = signal(this.#loadEnabled());
  readonly enabled = this.#enabled.asReadonly();

  setEnabled(enabled: boolean): void {
    this.#enabled.set(enabled);
    try {
      localStorage.setItem(AppBadgeService.STORAGE_KEY, String(enabled));
    } catch {
      // Storage blocked: the choice lasts until the page is closed.
    }
  }

  /** Shows the count, or clears the badge for 0 or when it is turned off. */
  show(count: number): void {
    if (!this.supported) {
      return;
    }
    const update =
      this.#enabled() && count > 0
        ? navigator.setAppBadge(count)
        : navigator.clearAppBadge();
    // Rejected when the app isn't installed or the platform refuses.
    update.catch(() => undefined);
  }

  #loadEnabled(): boolean {
    try {
      return localStorage.getItem(AppBadgeService.STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }
}

/** Running as the installed app rather than in a browser tab. */
function isInstalledApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const iosStandalone = (navigator as Navigator & { standalone?: boolean })
    .standalone;
  return (
    iosStandalone === true ||
    ['standalone', 'window-controls-overlay', 'fullscreen', 'minimal-ui'].some(
      (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
    )
  );
}
