import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';
import { filter, fromEvent, timer } from 'rxjs';
import { WeatherService } from '../../../core/services/weather.service';

@Component({
  selector: 'app-weather-widget',
  imports: [TooltipModule, TranslateModule],
  template: `
    @if (weatherService.weather()) {
      <div
        tooltipPosition="bottom"
        class="flex align-items-center gap-2 cursor-pointer weather-widget"
        [pTooltip]="tooltipText"
      >
        <div class="weather-icon-container">
          @switch (weatherService.weatherType()) {
            @case ('sunny') {
              <div class="weather-icon">
                <div class="sunny-rays"></div>
                <div class="sunny-body"></div>
              </div>
            }
            @case ('cloudy') {
              <div class="weather-icon">
                <div class="cloud"></div>
              </div>
            }
            @case ('partly-cloudy') {
              <div class="weather-icon">
                <div class="cloud"></div>
                <div class="partly-cloudy-sun"></div>
              </div>
            }
            @case ('rainy') {
              <div class="weather-icon">
                <div class="rain-cloud"></div>
                <div class="rain-drop"></div>
                <div class="rain-drop"></div>
                <div class="rain-drop"></div>
              </div>
            }
            @case ('snowy') {
              <div class="weather-icon">
                <div class="storm-cloud"></div>
                <div class="snow-flake">❄</div>
                <div class="snow-flake">❄</div>
                <div class="snow-flake">❄</div>
              </div>
            }
            @case ('stormy') {
              <div class="weather-icon">
                <div class="storm-cloud"></div>
                <div class="lightning"></div>
              </div>
            }
            @case ('foggy') {
              <div class="weather-icon">
                <div class="fog-line"></div>
                <div class="fog-line"></div>
                <div class="fog-line"></div>
              </div>
            }
            @default {
              <span class="text-2xl">❓</span>
            }
          }
        </div>
        <span class="font-bold text-sm"
          >{{ weatherService.weather()?.temperature }}°C</span
        >
      </div>
    }
  `,
  styleUrls: ['./weather-icons.scss'],
  styles: [
    `
      .weather-widget {
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

  ngOnInit(): void {
    timer(0, WeatherService.REFRESH_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe(() => this.#loadWeather());

    // Browsers throttle timers in background tabs: catch up when it is shown.
    fromEvent(this.#document, 'visibilitychange')
      .pipe(
        filter(
          () =>
            this.#document.visibilityState === 'visible' &&
            Date.now() - this.weatherService.lastFetchAt >=
              WeatherService.REFRESH_INTERVAL_MS,
        ),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe(() => this.#loadWeather());
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

  get tooltipText(): string {
    const w = this.weatherService.weather();
    if (!w) return '';

    const tempLabel = this.#translateService.instant('WEATHER.TEMP');
    const windLabel = this.#translateService.instant('WEATHER.WIND');

    return `${tempLabel}: ${w.temperature}°C, ${windLabel}: ${w.windSpeed} km/h`;
  }
}
