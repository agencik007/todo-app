export type WeatherType =
  'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'snowy' | 'stormy' | 'foggy';

/** Conditions right now, in °C, km/h, %, hPa and mm. */
export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number;
  cloudCover: number;
  pressure: number;
  windSpeed: number;
  windGusts: number;
  /** Where the wind blows from, in degrees (0 = north). */
  windDirection: number;
  weatherCode: number;
  isDay: boolean;
}

export interface HourlyForecast {
  /** Start of the hour (ms since epoch). */
  time: number;
  temperature: number;
  weatherCode: number;
  precipitationProbability: number | null;
  isDay: boolean;
}

export interface DailyForecast {
  /** Local midnight of the day (ms since epoch). */
  date: number;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number | null;
  sunrise: number;
  sunset: number;
  uvIndexMax: number | null;
}

export interface WeatherForecast {
  current: CurrentWeather;
  /** The next 24 hours, starting with the current one. */
  hourly: HourlyForecast[];
  /** Today and the next 6 days. */
  daily: DailyForecast[];
  /** IANA time zone of the forecast place, e.g. "Europe/Warsaw". */
  timeZone: string;
  /** When the forecast arrived (ms since epoch). */
  receivedAt: number;
}

/** Name of the place the forecast is for, in the interface language. */
export interface Place {
  name: string;
  /** Region or country, shown under the name in the details dialog. */
  region: string | null;
}
