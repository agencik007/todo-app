import { Component, inject, OnInit, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin } from 'rxjs';
import {
    WeatherData,
    WeatherService,
} from '../../../core/services/weather.service';

@Component({
    selector: 'app-weather-widget',
    imports: [TooltipModule, TranslateModule],
    template: `
        @if (weather()) {
            <div
                tooltipPosition="bottom"
                class="flex align-items-center gap-2 cursor-pointer weather-widget"
                [pTooltip]="tooltipText"
            >
                <div class="weather-icon-container">
                    @switch (weatherType) {
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
                    >{{ weather()?.temperature }}°C</span
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
    readonly #weatherService = inject(WeatherService);
    readonly #translateService = inject(TranslateService);

    visible = signal(false);
    weather = signal<WeatherData | null>(null);

    ngOnInit(): void {
        this.#weatherService.getGeolocation().subscribe({
            next: (position) => {
                this.visible.set(true);
                this.loadWeather(
                    position.coords.latitude,
                    position.coords.longitude,
                );
            },
            error: (err) => {
                console.warn('Geolocation denied or error:', err);
                this.visible.set(false);
            },
        });
    }

    private loadWeather(lat: number, lon: number): void {
        forkJoin({
            weather: this.#weatherService.getCurrentWeather(lat, lon),
            city: this.#weatherService.getCityName(lat, lon),
        }).subscribe({
            next: ({ weather, city }) => {
                this.weather.set({ ...weather, cityName: city });
            },
            error: (err) =>
                console.error('Failed to load weather or city name', err),
        });
    }

    get weatherType(): string {
        const code = this.weather()?.weatherCode;
        if (code === undefined) return 'unknown';

        // WMO Weather interpretation codes (WW)
        if (code === 0) return 'sunny';
        if (code >= 1 && code <= 3) {
            return code === 1 ? 'partly-cloudy' : 'cloudy';
        }
        if (code >= 45 && code <= 48) return 'foggy';
        if (code >= 51 && code <= 67) return 'rainy';
        if (code >= 71 && code <= 77) return 'snowy';
        if (code >= 80 && code <= 82) return 'rainy';
        if (code >= 85 && code <= 86) return 'snowy';
        if (code >= 95) return 'stormy';

        return 'partly-cloudy';
    }

    get tooltipText(): string {
        const w = this.weather();
        if (!w) return '';

        const tempLabel = this.#translateService.instant('WEATHER.TEMP');
        const windLabel = this.#translateService.instant('WEATHER.WIND');
        const cityPrefix = w.cityName ? `${w.cityName}: ` : '';

        return `${cityPrefix}${tempLabel}: ${w.temperature}°C, ${windLabel}: ${w.windSpeed} km/h`;
    }
}
