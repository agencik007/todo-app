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
import {
  ChosenLocation,
  CurrentWeather,
  Place,
  WeatherForecast,
  WeatherType,
} from '../models/weather.model';
import { LanguageService } from './language.service';
import { PlaceNameService } from './place-name.service';

/** Shape of the open-meteo /v1/forecast response (only the fields we use). */
interface OpenMeteoResponse {
  timezone: string;
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    cloud_cover: number;
    pressure_msl: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    wind_direction_10m: number;
    weather_code: number;
    is_day: number;
  };
  /** Times are unix seconds (timeformat=unixtime). */
  hourly: {
    time: number[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability: (number | null)[];
    is_day: number[];
  };
  daily: {
    time: number[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    sunrise: number[];
    sunset: number[];
    uv_index_max: (number | null)[];
  };
}

const FORECAST_QUERY = [
  'current=temperature_2m,apparent_temperature,relative_humidity_2m,' +
    'precipitation,cloud_cover,pressure_msl,wind_speed_10m,wind_gusts_10m,' +
    'wind_direction_10m,weather_code,is_day',
  'hourly=temperature_2m,weather_code,precipitation_probability,is_day',
  'daily=weather_code,temperature_2m_max,temperature_2m_min,' +
    'precipitation_probability_max,sunrise,sunset,uv_index_max',
  'forecast_hours=24',
  'forecast_days=7',
  'timezone=auto',
  'timeformat=unixtime',
].join('&');

interface Coordinates {
  lat: number;
  lon: number;
}

@Injectable({
  providedIn: 'root',
})
export class WeatherService {
  readonly #placeName = inject(PlaceNameService);
  readonly #languageService = inject(LanguageService);

  static readonly REFRESH_INTERVAL_MS = 30 * 60 * 1000;
  static readonly EFFECTS_STORAGE_KEY = 'weather_effects_enabled';
  static readonly LOCATION_STORAGE_KEY = 'weather_location';

  readonly #apiUrl = 'https://api.open-meteo.com/v1/forecast';

  readonly #location = signal<Coordinates | null>(null);

  readonly #chosenLocation = signal(this.#loadChosenLocation());
  /** A city the user picked; null while the device's position is used. */
  readonly chosenLocation = this.#chosenLocation.asReadonly();

  readonly #geolocationFailed = signal(false);
  /** No city chosen and the device's position is unavailable (denied). */
  readonly needsLocation = computed(
    () => !this.#chosenLocation() && this.#geolocationFailed(),
  );

  // Resource for fetching raw weather data
  // It automatically refetches when #location signal changes
  readonly #weatherResource = httpResource<OpenMeteoResponse>(() => {
    const loc = this.#location();
    if (!loc) return undefined;

    // Construct URL only when location is available
    return `${this.#apiUrl}?latitude=${loc.lat}&longitude=${loc.lon}&${FORECAST_QUERY}`;
  });

  // Publicly exposed signal with transformed data. A refresh or a failed one
  // at the same place keeps the last forecast, so the widget does not blink
  // every 30 minutes; another place starts empty.
  readonly forecast = linkedSignal<
    { raw: OpenMeteoResponse | undefined; location: Coordinates | null },
    WeatherForecast | null
  >({
    source: () => ({
      raw: this.#weatherResource.value(),
      location: this.#location(),
    }),
    computation: ({ raw, location }, previous) => {
      if (raw) return toForecast(raw);
      const previousLocation = previous?.source.location;
      const samePlace =
        !!location &&
        !!previousLocation &&
        location.lat === previousLocation.lat &&
        location.lon === previousLocation.lon;
      return samePlace ? (previous?.value ?? null) : null;
    },
  }).asReadonly();

  readonly weather = computed<CurrentWeather | null>(
    () => this.forecast()?.current ?? null,
  );

  /** Where the forecast is for; null while unknown. */
  readonly place = computed<Place | null>(() => {
    const chosen = this.#chosenLocation();
    return chosen
      ? { name: chosen.name, region: chosen.region }
      : this.#placeName.place();
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

  /** Time of the last forecast request (ms), 0 before the first one. */
  lastFetchAt = 0;

  constructor() {
    // The place name follows the interface language.
    effect(() => {
      this.#languageService.currentLang();
      untracked(() => {
        if (this.#location() && !this.#chosenLocation()) {
          this.#loadPosition(false);
        }
      });
    });
  }

  /** Fetches the forecast for the chosen city or the device's position. */
  refresh(): void {
    const chosen = this.#chosenLocation();
    if (chosen) {
      this.#fetchForecast({ lat: chosen.latitude, lon: chosen.longitude });
    } else {
      this.#loadPosition(true);
    }
  }

  /** Shows the weather for `location` from now on, without geolocation. */
  chooseLocation(location: ChosenLocation): void {
    this.#chosenLocation.set(location);
    try {
      localStorage.setItem(
        WeatherService.LOCATION_STORAGE_KEY,
        JSON.stringify(location),
      );
    } catch {
      // Storage blocked: the city is used until the page is closed.
    }
    this.refresh();
  }

  /** Forgets the chosen city and goes back to the device's position. */
  useDeviceLocation(): void {
    this.#chosenLocation.set(null);
    try {
      localStorage.removeItem(WeatherService.LOCATION_STORAGE_KEY);
    } catch {
      // Storage blocked: nothing was stored.
    }
    this.#location.set(null);
    this.refresh();
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

  #fetchForecast(location: Coordinates): void {
    this.lastFetchAt = Date.now();
    // A new object, so the resource fetches again at the same place.
    this.#location.set({ ...location });
  }

  #loadPosition(withForecast: boolean): void {
    this.#getGeolocation().subscribe({
      next: ({ coords }) => {
        this.#geolocationFailed.set(false);
        // A city chosen while the position was on its way wins.
        if (this.#chosenLocation()) return;
        if (withForecast) {
          this.#fetchForecast({ lat: coords.latitude, lon: coords.longitude });
        }
        this.#placeName.lookup(
          coords.latitude,
          coords.longitude,
          this.#languageService.currentLang(),
        );
      },
      // Denied, unavailable or unsupported: the widget offers a city search.
      error: () => this.#geolocationFailed.set(true),
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

  #loadChosenLocation(): ChosenLocation | null {
    try {
      const raw = localStorage.getItem(WeatherService.LOCATION_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ChosenLocation) : null;
    } catch {
      return null;
    }
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

function toForecast(raw: OpenMeteoResponse): WeatherForecast {
  const { current, hourly, daily } = raw;
  const ms = (seconds: number): number => seconds * 1000;
  return {
    current: {
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      precipitation: current.precipitation,
      cloudCover: current.cloud_cover,
      pressure: current.pressure_msl,
      windSpeed: current.wind_speed_10m,
      windGusts: current.wind_gusts_10m,
      windDirection: current.wind_direction_10m,
      weatherCode: current.weather_code,
      isDay: current.is_day === 1,
    },
    hourly: hourly.time.map((time, i) => ({
      time: ms(time),
      temperature: hourly.temperature_2m[i],
      weatherCode: hourly.weather_code[i],
      precipitationProbability: hourly.precipitation_probability[i],
      isDay: hourly.is_day[i] === 1,
    })),
    daily: daily.time.map((time, i) => ({
      date: ms(time),
      weatherCode: daily.weather_code[i],
      temperatureMax: daily.temperature_2m_max[i],
      temperatureMin: daily.temperature_2m_min[i],
      precipitationProbability: daily.precipitation_probability_max[i],
      sunrise: ms(daily.sunrise[i]),
      sunset: ms(daily.sunset[i]),
      uvIndexMax: daily.uv_index_max[i],
    })),
    timeZone: raw.timezone,
    receivedAt: Date.now(),
  };
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
export function toWeatherType(code: number): WeatherType {
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
