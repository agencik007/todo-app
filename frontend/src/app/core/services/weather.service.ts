import { httpResource } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  Injectable,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { Observable } from 'rxjs';
import { CurrentWeather, WeatherType } from '../models/weather.model';
import { LanguageService } from './language.service';
import { PlaceNameService } from './place-name.service';

/** Shape of the open-meteo /v1/forecast response (only the fields we use). */
interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    weather_code: number;
    is_day: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class WeatherService {
  readonly #placeName = inject(PlaceNameService);
  readonly #languageService = inject(LanguageService);

  static readonly REFRESH_INTERVAL_MS = 30 * 60 * 1000;
  static readonly EFFECTS_STORAGE_KEY = 'weather_effects_enabled';

  readonly #apiUrl = 'https://api.open-meteo.com/v1/forecast';

  readonly #location = signal<{ lat: number; lon: number } | null>(null);

  // Resource for fetching raw weather data
  // It automatically refetches when #location signal changes
  readonly #weatherResource = httpResource<OpenMeteoResponse>(() => {
    const loc = this.#location();
    if (!loc) return undefined;

    // Construct URL only when location is available
    return (
      `${this.#apiUrl}?latitude=${loc.lat}&longitude=${loc.lon}` +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,' +
      'wind_speed_10m,weather_code,is_day&timezone=auto'
    );
  });

  // Publicly exposed signal with transformed data. A refresh or a failed one
  // keeps the last forecast, so the widget does not blink every 30 minutes.
  readonly weather = linkedSignal<
    OpenMeteoResponse | undefined,
    CurrentWeather | null
  >({
    source: () => this.#weatherResource.value(),
    computation: (raw, previous) => {
      if (!raw) return previous?.value ?? null;

      return {
        temperature: raw.current.temperature_2m,
        apparentTemperature: raw.current.apparent_temperature,
        humidity: raw.current.relative_humidity_2m,
        windSpeed: raw.current.wind_speed_10m,
        weatherCode: raw.current.weather_code,
        isDay: raw.current.is_day === 1,
      };
    },
  }).asReadonly();

  /** Where the forecast is for; null while unknown. */
  readonly place = this.#placeName.place;

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

  /** Time of the last forecast request (ms), 0 before the first one. */
  lastFetchAt = 0;

  constructor() {
    // The place name follows the interface language.
    effect(() => {
      this.#languageService.currentLang();
      untracked(() => {
        if (this.#location()) this.#loadPosition(false);
      });
    });
  }

  /** Fetches the forecast and the place name for the device's position. */
  loadForCurrentPosition(): void {
    this.#loadPosition(true);
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

  #loadPosition(withForecast: boolean): void {
    this.#getGeolocation().subscribe({
      next: ({ coords }) => {
        if (withForecast) {
          this.lastFetchAt = Date.now();
          // A new object, so the resource fetches again at the same place.
          this.#location.set({ lat: coords.latitude, lon: coords.longitude });
        }
        this.#placeName.lookup(
          coords.latitude,
          coords.longitude,
          this.#languageService.currentLang(),
        );
      },
      error: (err) => console.error('Weather widget error:', err),
    });
  }

  #getGeolocation(): Observable<GeolocationPosition> {
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

/** i18n key describing a WMO weather interpretation code (WW). */
export function weatherDescriptionKey(code: number): string {
  return `WEATHER.CODE.${WEATHER_DESCRIPTIONS[code] ?? 'UNKNOWN'}`;
}

const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: 'CLEAR',
  1: 'MAINLY_CLEAR',
  2: 'PARTLY_CLOUDY',
  3: 'OVERCAST',
  45: 'FOG',
  48: 'RIME_FOG',
  51: 'DRIZZLE_LIGHT',
  53: 'DRIZZLE',
  55: 'DRIZZLE_DENSE',
  56: 'FREEZING_DRIZZLE',
  57: 'FREEZING_DRIZZLE',
  61: 'RAIN_LIGHT',
  63: 'RAIN',
  65: 'RAIN_HEAVY',
  66: 'FREEZING_RAIN',
  67: 'FREEZING_RAIN',
  71: 'SNOW_LIGHT',
  73: 'SNOW',
  75: 'SNOW_HEAVY',
  77: 'SNOW_GRAINS',
  80: 'SHOWERS_LIGHT',
  81: 'SHOWERS',
  82: 'SHOWERS_HEAVY',
  85: 'SNOW_SHOWERS',
  86: 'SNOW_SHOWERS',
  95: 'THUNDERSTORM',
  96: 'THUNDERSTORM_HAIL',
  99: 'THUNDERSTORM_HAIL',
};

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
