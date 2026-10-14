import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';

/** Chromium's install prompt event (not in the TypeScript DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Offers "Install app" where the browser allows it (Chromium browsers fire
 * `beforeinstallprompt` once the PWA install criteria are met). Safari and
 * Firefox have no such event, so the menu item simply never shows there.
 */
@Injectable({
  providedIn: 'root',
})
export class PwaInstallService {
  readonly #document = inject(DOCUMENT);
  readonly #platformId = inject(PLATFORM_ID);

  readonly #installPrompt = signal<BeforeInstallPromptEvent | null>(null);

  /** True when the browser can show its install dialog right now. */
  readonly canInstall = computed(() => this.#installPrompt() !== null);

  /**
   * Starts listening. Runs as an app initializer because the browser fires
   * `beforeinstallprompt` early, often before the user menu exists.
   */
  init(): void {
    const window = this.#document.defaultView;
    if (!isPlatformBrowser(this.#platformId) || !window) {
      return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
      // Keep the event for our own menu item instead of the browser's
      // automatic mini-infobar on Android.
      event.preventDefault();
      this.#installPrompt.set(event as BeforeInstallPromptEvent);
    });
    window.addEventListener('appinstalled', () =>
      this.#installPrompt.set(null),
    );
  }

  /** Shows the browser's install dialog; the event can be used only once. */
  async install(): Promise<void> {
    const promptEvent = this.#installPrompt();
    if (!promptEvent) {
      return;
    }
    this.#installPrompt.set(null);
    await promptEvent.prompt();
    await promptEvent.userChoice;
  }
}
