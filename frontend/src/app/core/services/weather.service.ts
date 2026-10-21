import { httpResource } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

export interface WeatherData {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
}

export type WeatherType =
  'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'snowy' | 'stormy' | 'foggy';

/** Shape of the open-meteo /v1/forecast response (only the fields we use). */
interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
    weather_code: number;
    is_day: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class WeatherService {
  static readonly REFRESH_INTERVAL_MS = 30 * 60 * 1000;
  static readonly EFFECTS_STORAGE_KEY = 'weather_effects_enabled';

  readonly #apiUrl = 'https://api.open-meteo.com/v1/forecast';

  // A new object on every fetchWeather() call, so the resource fetches again
  // even when the coordinates did not change.
  readonly #location = signal<{ lat: number; lon: number } | null>(null);

  // Resource for fetching raw weather data
  // It automatically refetches when #location signal changes
  readonly #weatherResource = httpResource<OpenMeteoResponse>(() => {
    const loc = this.#location();
    if (!loc) return undefined;

    // Construct URL only when location is available
    return `${this.#apiUrl}?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,wind_speed_10m,weather_code,is_day`;
  });

  // Publicly exposed signal with transformed data
  readonly weather = computed<WeatherData | null>(() => {
    const raw = this.#weatherResource.value();
    if (!raw) return null;

    return {
      temperature: raw.current.temperature_2m,
      windSpeed: raw.current.wind_speed_10m,
      weatherCode: raw.current.weather_code,
      isDay: raw.current.is_day === 1,
    };
  });

  readonly weatherType = computed<WeatherType | null>(() => {
    const code = this.weather()?.weatherCode;
    return code === undefined ? null : toWeatherType(code);
  });

  readonly isLoading = this.#weatherResource.isLoading;
  readonly error = this.#weatherResource.error;

  readonly #effectsEnabled = signal(this.#loadEffectsEnabled());
  /** Full-screen weather scene after each forecast update (user setting). */
  readonly effectsEnabled = this.#effectsEnabled.asReadonly();

  readonly #replayRequests = signal(0);
  /** Bumped when the user asks to see the current weather scene again. */
  readonly replayRequests = this.#replayRequests.asReadonly();

  /** Time of the last fetchWeather() call (ms), 0 before the first one. */
  lastFetchAt = 0;

  // Action to update location and trigger fetch
  fetchWeather(lat: number, lon: number): void {
    this.lastFetchAt = Date.now();
    this.#location.set({ lat, lon });
  }

  setEffectsEnabled(enabled: boolean): void {
    this.#effectsEnabled.set(enabled);
    try {
      localStorage.setItem(WeatherService.EFFECTS_STORAGE_KEY, String(enabled));
    } catch {
      // Storage blocked: the choice lasts until the page is closed.
    }
  }

  replayEffect(): void {
    this.#replayRequests.update((count) => count + 1);
  }

  getGeolocation(): Observable<GeolocationPosition> {
    return new Observable((observer) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            observer.next(position);
            observer.complete();
          },
          (error) => {
            observer.error(error);
          },
        );
      } else {
        observer.error(new Error('Geolocation not supported'));
      }
    });
  }

  #loadEffectsEnabled(): boolean {
    try {
      return (
        localStorage.getItem(WeatherService.EFFECTS_STORAGE_KEY) !== 'false'
      );
    } catch {
      return true;
    }
  }
}

/** Maps a WMO weather interpretation code (WW) to a weather type. */
function toWeatherType(code: number): WeatherType {
  if (code === 0) return 'sunny';
  if (code === 1) return 'partly-cloudy';
  if (code >= 2 && code <= 3) return 'cloudy';
  if (code >= 45 && code <= 48) return 'foggy';
  if (code >= 51 && code <= 67) return 'rainy';
  if (code >= 71 && code <= 77) return 'snowy';
  if (code >= 80 && code <= 82) return 'rainy';
  if (code >= 85 && code <= 86) return 'snowy';
  if (code >= 95) return 'stormy';
  return 'partly-cloudy';
}
