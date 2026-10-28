import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';
import { filter, first, fromEvent, interval, merge } from 'rxjs';
import { LanguageService } from '../../../core/services/language.service';
import {
  weatherDescriptionKey,
  WeatherService,
} from '../../../core/services/weather.service';
import { IconButtonDirective } from '../../ui/icon-button/icon-button.directive';
import { WeatherDetailsDialogComponent } from './weather-details-dialog/weather-details-dialog.component';
import { WeatherIconComponent } from './weather-icon/weather-icon.component';

@Component({
  selector: 'app-weather-widget',
  imports: [
    TooltipModule,
    TranslateModule,
    IconButtonDirective,
    WeatherIconComponent,
    WeatherDetailsDialogComponent,
  ],
  template: `
    @if (weatherService.weather(); as weather) {
      <button
        type="button"
        tooltipPosition="bottom"
        class="flex align-items-center gap-2 cursor-pointer weather-widget"
        aria-haspopup="dialog"
        #widgetButton
        [pTooltip]="tooltipText()"
        [attr.aria-label]="
          tooltipText() + '. ' + ('WEATHER.OPEN_DETAILS' | translate)
        "
        (click)="onOpenDetails()"
      >
        <span class="weather-icon-container">
          @if (weatherService.weatherType(); as type) {
            <app-weather-icon [type]="type" [isDay]="weather.isDay" />
          }
        </span>
        <span class="font-bold text-sm">{{ temperature() }}°C</span>
      </button>
    } @else if (weatherService.needsLocation()) {
      <!-- Location access is off: let the user pick a city instead. -->
      <button
        type="button"
        tooltipPosition="bottom"
        size="xl"
        aria-haspopup="dialog"
        appIconButton
        #widgetButton
        [pTooltip]="'WEATHER.SET_LOCATION' | translate"
        [attr.aria-label]="'WEATHER.SET_LOCATION' | translate"
        (click)="onOpenDetails()"
      >
        <i class="pi pi-map-marker"></i>
      </button>
    }

    <!-- Loaded on the first click; prefetched once the app is idle. -->
    @defer (when isDetailsOpen(); prefetch on idle) {
      <app-weather-details-dialog
        [visible]="isDetailsOpen()"
        (visibleChange)="isDetailsOpen.set($event)"
        (closed)="onDetailsClosed()"
      />
    }
  `,
  styles: [
    `
      .weather-widget {
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        padding: 0.25rem 0.5rem;
        border-radius: 8px;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
      }
      .weather-widget:hover {
        background-color: var(--surface-hover);
      }
      .weather-icon-container {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
    `,
  ],
})
export class WeatherWidgetComponent implements OnInit {
  readonly weatherService = inject(WeatherService);
  readonly #translateService = inject(TranslateService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #document = inject(DOCUMENT);
  readonly #appRef = inject(ApplicationRef);
  readonly #languageService = inject(LanguageService);

  readonly widgetButton =
    viewChild<ElementRef<HTMLButtonElement>>('widgetButton');

  readonly isDetailsOpen = signal(false);

  readonly temperature = computed(() =>
    Math.round(this.weatherService.weather()?.temperature ?? 0),
  );

  readonly tooltipText = computed(() => {
    const w = this.weatherService.weather();
    if (!w) return '';
    // Re-translate when the language (and its translations) change.
    this.#languageService.currentLang();

    const t = (key: string, params?: object): string =>
      this.#translateService.instant(key, params);
    return t('WEATHER.TOOLTIP', {
      place: this.weatherService.place()?.name ?? t('WEATHER.YOUR_LOCATION'),
      description: t(weatherDescriptionKey(w.weatherCode)),
      temp: Math.round(w.temperature),
      feelsLike: Math.round(w.apparentTemperature),
      wind: Math.round(w.windSpeed),
    });
  });

  ngOnInit(): void {
    this.#loadWeather();

    // Start refreshing only once the app is stable: a pending interval keeps
    // it unstable, which holds back the service worker registration
    // (registerWhenStable) until its 30 s fallback.
    this.#appRef.isStable
      .pipe(first(Boolean), takeUntilDestroyed(this.#destroyRef))
      .subscribe(() =>
        merge(
          interval(WeatherService.REFRESH_INTERVAL_MS),
          // Browsers throttle timers in background tabs: catch up when shown.
          fromEvent(this.#document, 'visibilitychange').pipe(
            filter(
              () =>
                this.#document.visibilityState === 'visible' &&
                Date.now() - this.weatherService.lastFetchAt >=
                  WeatherService.REFRESH_INTERVAL_MS,
            ),
          ),
        )
          .pipe(takeUntilDestroyed(this.#destroyRef))
          .subscribe(() => this.#loadWeather()),
      );
  }

  #loadWeather(): void {
    this.weatherService.refresh();
  }

  onOpenDetails(): void {
    this.isDetailsOpen.set(true);
  }

  /**
   * Back to the widget, where keyboard users opened the dialog. Only once the
   * dialog is gone: PrimeNG moves focus into it after the opening animation,
   * so an earlier call loses to that when the dialog is closed right away.
   */
  onDetailsClosed(): void {
    this.widgetButton()?.nativeElement.focus();
  }
}
