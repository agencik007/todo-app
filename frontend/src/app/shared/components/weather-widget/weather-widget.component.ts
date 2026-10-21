import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  Component,
  DestroyRef,
  inject,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';
import { filter, first, fromEvent, interval, merge } from 'rxjs';
import { WeatherService } from '../../../core/services/weather.service';

@Component({
  selector: 'app-weather-widget',
  imports: [TooltipModule, TranslateModule],
  template: `
    @if (weatherService.weather()) {
      <button
        type="button"
        tooltipPosition="bottom"
        class="flex align-items-center gap-2 cursor-pointer weather-widget"
        [pTooltip]="tooltipText"
        [attr.aria-label]="tooltipText + '. ' + ('WEATHER.REPLAY' | translate)"
        (click)="onReplay()"
      >
        <span class="weather-icon-container">
          @switch (weatherService.weatherType()) {
            @case ('sunny') {
              <span class="weather-icon">
                <span class="sunny-rays"></span>
                <span class="sunny-body"></span>
              </span>
            }
            @case ('cloudy') {
              <span class="weather-icon">
                <span class="cloud"></span>
              </span>
            }
            @case ('partly-cloudy') {
              <span class="weather-icon">
                <span class="cloud"></span>
                <span class="partly-cloudy-sun"></span>
              </span>
            }
            @case ('rainy') {
              <span class="weather-icon">
                <span class="rain-cloud"></span>
                <span class="rain-drop"></span>
                <span class="rain-drop"></span>
                <span class="rain-drop"></span>
              </span>
            }
            @case ('snowy') {
              <span class="weather-icon">
                <span class="storm-cloud"></span>
                <span class="snow-flake">❄</span>
                <span class="snow-flake">❄</span>
                <span class="snow-flake">❄</span>
              </span>
            }
            @case ('stormy') {
              <span class="weather-icon">
                <span class="storm-cloud"></span>
                <span class="lightning"></span>
              </span>
            }
            @case ('foggy') {
              <span class="weather-icon">
                <span class="fog-line"></span>
                <span class="fog-line"></span>
                <span class="fog-line"></span>
              </span>
            }
            @default {
              <span class="text-2xl">❓</span>
            }
          }
        </span>
        <span class="font-bold text-sm"
          >{{ weatherService.weather()?.temperature }}°C</span
        >
      </button>
    }
  `,
  styleUrls: ['./weather-icons.scss'],
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
    this.weatherService.getGeolocation().subscribe({
      next: (position) =>
        this.weatherService.fetchWeather(
          position.coords.latitude,
          position.coords.longitude,
        ),
      error: (err) => console.error('Weather widget error:', err),
    });
  }

  onReplay(): void {
    this.weatherService.replayEffect();
  }

  get tooltipText(): string {
    const w = this.weatherService.weather();
    if (!w) return '';

    const tempLabel = this.#translateService.instant('WEATHER.TEMP');
    const windLabel = this.#translateService.instant('WEATHER.WIND');

    return `${tempLabel}: ${w.temperature}°C, ${windLabel}: ${w.windSpeed} km/h`;
  }
}
