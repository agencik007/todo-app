export type WeatherType =
  'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'snowy' | 'stormy' | 'foggy';

/** Conditions right now, in °C and km/h. */
export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
}

/** Name of the place the forecast is for, in the interface language. */
export interface Place {
  name: string;
  /** Region or country, shown under the name in the details dialog. */
  region: string | null;
}
