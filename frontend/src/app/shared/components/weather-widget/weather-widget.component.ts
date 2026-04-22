import { Component, inject, OnInit, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';
import { switchMap } from 'rxjs';
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

    visible = signal(false);

    ngOnInit(): void {
        this.weatherService
            .getGeolocation()
            .pipe(
                switchMap((position) => {
                    this.visible.set(true);
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;

                    this.weatherService.fetchWeather(lat, lon);
                    return [];
                }),
            )
            .subscribe({
                error: (err) => {
                    console.error('Weather widget error:', err);
                    this.visible.set(false);
                },
            });
    }

    get weatherType(): string {
        const code = this.weatherService.weather()?.weatherCode;
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
        const w = this.weatherService.weather();
        if (!w) return '';

        const tempLabel = this.#translateService.instant('WEATHER.TEMP');
        const windLabel = this.#translateService.instant('WEATHER.WIND');

        return `${tempLabel}: ${w.temperature}°C, ${windLabel}: ${w.windSpeed} km/h`;
    }
}
