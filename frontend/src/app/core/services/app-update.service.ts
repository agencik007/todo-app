import { DOCUMENT } from '@angular/common';
import { ApplicationRef, DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { filter, first, fromEvent, interval, merge } from 'rxjs';

/**
 * Keeps the app on the latest release when the Angular service worker is on.
 *
 * The service worker downloads a new version in the background after each
 * deploy; this service offers a reload once it is ready (never reloads on its
 * own, which would lose unsaved input), checks for updates periodically
 * because an installed app can stay open for days, and asks for a reload when
 * the cached version is broken beyond repair.
 */
@Injectable({
  providedIn: 'root',
})
export class AppUpdateService {
  readonly #swUpdate = inject(SwUpdate);
  readonly #messageService = inject(MessageService);
  readonly #translate = inject(TranslateService);
  readonly #appRef = inject(ApplicationRef);
  readonly #destroyRef = inject(DestroyRef);
  readonly #document = inject(DOCUMENT);

  static readonly TOAST_KEY = 'app-update';
  static readonly CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

  #showReloadToast(summaryKey: string, detailKey: string): void {
    this.#messageService.clear(AppUpdateService.TOAST_KEY);
    this.#messageService.add({
      key: AppUpdateService.TOAST_KEY,
      severity: 'info',
      summary: this.#translate.instant(summaryKey),
      detail: this.#translate.instant(detailKey),
      sticky: true,
      closable: true,
    });
  }

  #checkForUpdate(): void {
    this.#swUpdate
      .checkForUpdate()
      .catch((error: unknown) =>
        console.error('Service worker update check failed', error),
      );
  }

  /** Subscribes to service worker events. A no-op on the server and in dev. */
  init(): void {
    if (!this.#swUpdate.isEnabled) {
      return;
    }

    this.#swUpdate.versionUpdates
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((event) => {
        if (event.type === 'VERSION_READY') {
          this.#showReloadToast(
            'PWA.UPDATE_READY_SUMMARY',
            'PWA.UPDATE_READY_DETAIL',
          );
        } else if (event.type === 'VERSION_INSTALLATION_FAILED') {
          // The current version keeps working; the next check retries.
          console.error('Installing the new app version failed', event.error);
        }
      });

    this.#swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() =>
        this.#showReloadToast(
          'PWA.UNRECOVERABLE_SUMMARY',
          'PWA.UNRECOVERABLE_DETAIL',
        ),
      );

    // Start polling only once the app is stable, so it doesn't delay startup.
    this.#appRef.isStable
      .pipe(first(Boolean), takeUntilDestroyed(this.#destroyRef))
      .subscribe(() =>
        merge(
          interval(AppUpdateService.CHECK_INTERVAL_MS),
          fromEvent(this.#document, 'visibilitychange').pipe(
            filter(() => this.#document.visibilityState === 'visible'),
          ),
        )
          .pipe(takeUntilDestroyed(this.#destroyRef))
          .subscribe(() => this.#checkForUpdate()),
      );
  }

  reload(): void {
    this.#document.location.reload();
  }
}
