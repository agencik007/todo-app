import { isPlatformBrowser } from '@angular/common';
import { HttpContext } from '@angular/common/http';
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

export type PushState = 'unsupported' | 'unavailable' | 'denied' | 'off' | 'on';

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
  static readonly FORGET_TIMEOUT_MS = 3000;

  readonly #destroyRef = inject(DestroyRef);
  readonly #messageService = inject(MessageService);
  readonly #platformId = inject(PLATFORM_ID);
  readonly #push = inject(PushService);
  readonly #swPush = inject(SwPush);
  readonly #translate = inject(TranslateService);

  readonly #isBrowser = isPlatformBrowser(this.#platformId);
  readonly #config = signal<PushConfig | null>(null);
  readonly #permission = signal<NotificationPermission>('default');
  readonly #subscription = signal<PushSubscription | null>(null);
  readonly #busy = signal(false);

  /** A subscribe / unsubscribe / test request is in flight. */
  readonly busy = this.#busy.asReadonly();

  readonly state = computed<PushState>(() => {
    if (!this.#isBrowser || !this.#swPush.isEnabled || !hasNotificationApi()) {
      return 'unsupported';
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
    } catch {
      // Unreachable: the toggle stays unavailable until the next refresh.
    }
  }

  /** Asks for permission, subscribes this browser and registers it. */
  async enable(): Promise<boolean> {
    const publicKey = this.#config()?.publicKey;
    if (this.state() !== 'off' || !publicKey) {
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
        // Permission refused or the push service is unreachable.
        return false;
      } finally {
        this.#permission.set(Notification.permission);
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
   * Logout: removes this browser's subscription so the next user of the
   * device gets no reminders. Never blocks logout for more than 3 seconds and
   * swallows every error.
   */
  async forgetDevice(): Promise<void> {
    if (!this.#isBrowser || !this.#swPush.isEnabled) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, PushNotificationsService.FORGET_TIMEOUT_MS);
    });
    try {
      await Promise.race([this.#forget(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async #forget(): Promise<void> {
    try {
      const subscription = await firstValueFrom(this.#swPush.subscription);
      if (!subscription) {
        return;
      }
      await firstValueFrom(
        this.#push.unsubscribePushSubscriptionsDelete(
          { endpoint: subscription.endpoint },
          'body',
          false,
          { context: new HttpContext().set(SILENT_NOTIFICATIONS, true) },
        ),
      );
      await this.#swPush.unsubscribe();
    } catch {
      // Logout goes on.
    }
  }
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
