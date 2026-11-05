import { isPlatformBrowser } from '@angular/common';
import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwPush } from '@angular/service-worker';
import { PushConfig } from '@api';
import { PushService } from '@api/api/push.service';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { SILENT_NOTIFICATIONS } from '../interceptors/notification.interceptor';

export type PushState =
  'loading' | 'unsupported' | 'unavailable' | 'denied' | 'off' | 'on';

/**
 * Browser (Web Push) notifications for task reminders on this device.
 *
 * `state` drives the settings toggle: `unsupported` without a service worker
 * (`ng serve`) or the Notification API (iOS Safari outside the installed app),
 * `unavailable` while the server config is unknown or push is switched off
 * there, `denied` when the browser blocks notifications, otherwise `on` / `off`
 * by whether this browser holds a push subscription. The permission prompt
 * appears only from `enable()`, which the toggle calls on click.
 */
@Injectable({
  providedIn: 'root',
})
export class PushNotificationsService {
  readonly #destroyRef = inject(DestroyRef);
  readonly #messageService = inject(MessageService);
  readonly #platformId = inject(PLATFORM_ID);
  readonly #push = inject(PushService);
  readonly #swPush = inject(SwPush);
  readonly #translate = inject(TranslateService);

  static readonly FORGET_TIMEOUT_MS = 3000;

  readonly #isBrowser = isPlatformBrowser(this.#platformId);
  readonly #config = signal<PushConfig | null>(null);
  readonly #configLoaded = signal(false);
  readonly #permission = signal<NotificationPermission>('default');
  readonly #subscription = signal<PushSubscription | null>(null);
  readonly #busy = signal(false);

  /** A subscribe / unsubscribe / test request is in flight. */
  readonly busy = this.#busy.asReadonly();

  readonly state = computed<PushState>(() => {
    if (!this.#isBrowser || !this.#swPush.isEnabled || !hasNotificationApi()) {
      return 'unsupported';
    }
    if (!this.#configLoaded()) {
      return 'loading';
    }
    if (!this.#config()?.enabled) {
      return 'unavailable';
    }
    if (this.#permission() === 'denied') {
      return 'denied';
    }
    return this.#subscription() ? 'on' : 'off';
  });

  /** iOS only delivers web push to the app added to the home screen. */
  readonly showIosInstallHint = computed(() => isIosBrowserTab());

  constructor() {
    if (this.#isBrowser && this.#swPush.isEnabled) {
      this.#swPush.subscription
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe((subscription) => this.#subscription.set(subscription));
    }
    if (this.#isBrowser && hasNotificationApi()) {
      // The user may block or allow notifications in the browser meanwhile.
      this.#permission.set(Notification.permission);
      document.addEventListener('visibilitychange', () =>
        this.#permission.set(Notification.permission),
      );
    }
  }

  /** Loads the server config and the browser's permission; call when online. */
  async refresh(): Promise<void> {
    if (!this.#isBrowser || !this.#swPush.isEnabled || !hasNotificationApi()) {
      return;
    }
    this.#permission.set(Notification.permission);
    try {
      this.#config.set(
        await firstValueFrom(
          this.#push.getPushConfigPushConfigGet('body', false, {
            context: new HttpContext().set(SILENT_NOTIFICATIONS, true),
          }),
        ),
      );
      this.#configLoaded.set(true);
    } catch {
      // Unreachable: the toggle stays disabled until the next refresh.
      return;
    }
    await this.#verifySubscription();
  }

  /** Asks for permission, subscribes this browser and registers it. */
  async enable(): Promise<boolean> {
    const publicKey = this.#config()?.publicKey;
    if (this.state() !== 'off' || !publicKey) {
      return false;
    }

    // Called first, still inside the click: Safari / iOS only show the prompt
    // while the user's tap is the current activation.
    const permission = await Notification.requestPermission();
    this.#permission.set(permission);
    if (permission !== 'granted') {
      return false;
    }

    this.#busy.set(true);
    try {
      let subscription: PushSubscription;
      try {
        subscription = await this.#swPush.requestSubscription({
          serverPublicKey: publicKey,
        });
      } catch {
        // The push service is unreachable.
        return false;
      }

      const { keys } = subscription.toJSON();
      try {
        await firstValueFrom(
          this.#push.subscribePushSubscriptionsPost({
            endpoint: subscription.endpoint,
            keys: {
              p256Dh: keys?.['p256dh'] ?? '',
              auth: keys?.['auth'] ?? '',
            },
            userAgent: navigator.userAgent,
          }),
        );
      } catch {
        // The server refused it (the interceptor shows why): keep it off.
        await this.#swPush.unsubscribe().catch(() => undefined);
        return false;
      }
      return true;
    } finally {
      this.#busy.set(false);
    }
  }

  /** Forgets this browser on the server first, then drops the subscription. */
  async disable(): Promise<void> {
    const subscription = this.#subscription();
    if (!subscription) {
      return;
    }

    this.#busy.set(true);
    try {
      await firstValueFrom(
        this.#push.unsubscribePushSubscriptionsDelete({
          endpoint: subscription.endpoint,
        }),
      );
      await this.#swPush.unsubscribe();
    } catch {
      // Still on: the server may still push to this browser.
    } finally {
      this.#busy.set(false);
    }
  }

  async sendTest(): Promise<void> {
    this.#busy.set(true);
    try {
      const result = await firstValueFrom(
        this.#push.sendTestPushPushTestPost('body', false, {
          context: new HttpContext().set(SILENT_NOTIFICATIONS, true),
        }),
      );
      if (result.sent === 0) {
        // The server has no device to push to: the toggle's "on" is stale.
        this.#messageService.add({
          severity: 'warn',
          summary: this.#translate.instant('MESSAGES.ERROR'),
          detail: this.#translate.instant('SETTINGS.NOTIFICATIONS.TEST_NONE'),
          life: 5000,
        });
        return;
      }
      this.#messageService.add({
        severity: 'success',
        summary: this.#translate.instant('MESSAGES.SUCCESS'),
        detail: this.#translate.instant(`API_MESSAGES.${result.message}`),
        life: 3000,
      });
    } catch {
      // The interceptor already showed the error.
    } finally {
      this.#busy.set(false);
    }
  }

  /**
   * Logout: tells the server to forget this browser (best effort, needs the
   * access token, at most 3 seconds), then always drops the subscription so
   * the next user of the device gets no reminders. Never throws.
   */
  async forgetDevice(): Promise<void> {
    const subscription = this.#subscription();
    if (!this.#isBrowser || !this.#swPush.isEnabled || !subscription) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, PushNotificationsService.FORGET_TIMEOUT_MS);
    });
    try {
      await Promise.race([this.#forget(subscription), timeout]);
    } finally {
      clearTimeout(timer);
      this.dropLocal();
    }
  }

  /**
   * A session ended (expired, account deleted, logout): drop this browser's
   * subscription without the server. The push service then answers 410 and
   * the server prunes the row, so the next user doesn't get these reminders.
   */
  dropLocal(): void {
    if (!this.#isBrowser || !this.#swPush.isEnabled) {
      return;
    }
    this.#swPush.unsubscribe().catch(() => undefined);
  }

  /**
   * "On" must mean the server knows this browser: re-registers the browser's
   * subscription (idempotent) so a row the server pruned, or never stored, is
   * restored. A subscription the server refuses, or one made with an old
   * VAPID key, is dropped locally and the toggle shows off.
   */
  async #verifySubscription(): Promise<void> {
    const subscription = this.#subscription();
    const config = this.#config();
    if (!subscription || !config?.enabled || !config.publicKey) {
      return;
    }

    if (!matchesServerKey(subscription, config.publicKey)) {
      await this.#swPush.unsubscribe().catch(() => undefined);
      return;
    }

    const { keys } = subscription.toJSON();
    try {
      await firstValueFrom(
        this.#push.subscribePushSubscriptionsPost(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256Dh: keys?.['p256dh'] ?? '',
              auth: keys?.['auth'] ?? '',
            },
            userAgent: navigator.userAgent,
          },
          'body',
          false,
          { context: new HttpContext().set(SILENT_NOTIFICATIONS, true) },
        ),
      );
    } catch (error) {
      if (isRefusal(error)) {
        await this.#swPush.unsubscribe().catch(() => undefined);
      }
      // Anything else (server down, session over): try again next time.
    }
  }

  async #forget(subscription: PushSubscription): Promise<void> {
    try {
      await firstValueFrom(
        this.#push.unsubscribePushSubscriptionsDelete(
          { endpoint: subscription.endpoint },
          'body',
          false,
          { context: new HttpContext().set(SILENT_NOTIFICATIONS, true) },
        ),
      );
    } catch {
      // Logout goes on.
    }
  }
}

/** The server answered that it will not take this subscription (not a 401). */
function isRefusal(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status >= 400 &&
    error.status < 500 &&
    ![401, 408, 429].includes(error.status)
  );
}

/** Whether the subscription was made with the server's current VAPID key. */
function matchesServerKey(
  subscription: PushSubscription,
  publicKey: string,
): boolean {
  const key = subscription.options?.applicationServerKey;
  if (!key) {
    return true; // Not exposed by this browser: assume it matches.
  }
  const actual = new Uint8Array(key);
  const padded = publicKey.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return (
    actual.length === binary.length &&
    actual.every((byte, index) => byte === binary.charCodeAt(index))
  );
}

function hasNotificationApi(): boolean {
  return typeof Notification !== 'undefined';
}

/** iPhone / iPad (also iPadOS posing as a Mac) outside the installed app. */
function isIosBrowserTab(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  return isIos && !standalone;
}
