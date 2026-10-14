import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { API_URL } from '../tokens/api-url.token';

/**
 * Whether the API can be reached.
 *
 * `navigator.onLine` alone isn't enough: it only says the device has a
 * network, not that the server answers (captive portals, server down). So API
 * calls also report back (see notificationInterceptor): a request that never
 * reached the API (see isServerUnreachable) marks the app offline, and while the
 * browser claims to be online a health check retries until the API answers.
 */
@Injectable({
  providedIn: 'root',
})
export class NetworkStatusService {
  readonly #document = inject(DOCUMENT);
  readonly #platformId = inject(PLATFORM_ID);
  readonly #apiUrl = inject(API_URL);

  static readonly RETRY_MS = 15_000;

  readonly #online = signal(true);
  readonly online = this.#online.asReadonly();

  #retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const window = this.#document.defaultView;
    if (!isPlatformBrowser(this.#platformId) || !window) {
      return;
    }

    this.#online.set(window.navigator.onLine);
    window.addEventListener('online', () => this.reportReachable());
    window.addEventListener('offline', () => this.#setOffline());
  }

  #setOffline(): void {
    this.#online.set(false);
    if (this.#retryTimer) {
      clearTimeout(this.#retryTimer);
      this.#retryTimer = null;
    }
  }

  #scheduleHealthCheck(): void {
    if (this.#retryTimer) {
      return;
    }
    this.#retryTimer = setTimeout(async () => {
      this.#retryTimer = null;
      if (!this.#document.defaultView?.navigator.onLine) {
        return; // the browser's `online` event takes over
      }
      try {
        const response = await fetch(`${this.#apiUrl}/auth/health`, {
          cache: 'no-store',
        });
        if (response.ok) {
          this.reportReachable();
          return;
        }
      } catch {
        // still unreachable
      }
      this.#scheduleHealthCheck();
    }, NetworkStatusService.RETRY_MS);
  }

  /** An API call failed without reaching the API (isServerUnreachable). */
  reportUnreachable(): void {
    this.#online.set(false);
    this.#scheduleHealthCheck();
  }

  /** An API call got a response, so the server is reachable. */
  reportReachable(): void {
    if (this.#retryTimer) {
      clearTimeout(this.#retryTimer);
      this.#retryTimer = null;
    }
    this.#online.set(true);
  }
}
