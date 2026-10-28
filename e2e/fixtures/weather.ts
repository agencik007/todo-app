/** Canned answers of the weather widget's third-party APIs. */

/** 2026-06-01 10:00 in Warsaw (UTC+2), in unix seconds as open-meteo sends them. */
const START = Date.UTC(2026, 5, 1, 8) / 1000;
const HOUR = 3600;
const hours = Array.from({ length: 24 }, (_, i) => START + i * HOUR);
const days = Array.from({ length: 7 }, (_, i) => Date.UTC(2026, 5, 1 + i) / 1000 - 2 * HOUR);

export const weatherMock = {
  forecast: {
    timezone: 'Europe/Warsaw',
    current: {
      temperature_2m: 20.4,
      apparent_temperature: 18.6,
      relative_humidity_2m: 55,
      precipitation: 0,
      cloud_cover: 10,
      pressure_msl: 1015.3,
      wind_speed_10m: 5.2,
      wind_gusts_10m: 12.8,
      wind_direction_10m: 315,
      weather_code: 0,
      is_day: 1,
    },
    hourly: {
      time: hours,
      temperature_2m: hours.map((_, i) => 20 + Math.round(5 * Math.sin(i / 4))),
      weather_code: hours.map((_, i) => (i > 4 && i < 8 ? 61 : 1)),
      precipitation_probability: hours.map((_, i) => (i > 4 && i < 8 ? 70 : 0)),
      // Sunset 21:00, sunrise 4:30 (local).
      is_day: hours.map((time) => Number(time < days[0] + 21 * HOUR || time >= days[1] + 5 * HOUR)),
    },
    daily: {
      time: days,
      weather_code: [0, 61, 3, 95, 1, 2, 71],
      temperature_2m_max: [24, 19, 21, 26, 22, 18, 9],
      temperature_2m_min: [12, 11, 10, 15, 13, 9, 2],
      precipitation_probability_max: [0, 80, 10, 60, 5, 15, 40],
      sunrise: days.map((day) => day + 4.5 * HOUR),
      sunset: days.map((day) => day + 21 * HOUR),
      uv_index_max: [6.3, 2, 4, 7, 5, 3, 1],
    },
  },
  /** City search results, whatever the query. */
  cities: {
    results: [
      { name: 'Gdańsk', latitude: 54.35, longitude: 18.65, admin1: 'Pomerania', country: 'Poland' },
      { name: 'Gdynia', latitude: 54.52, longitude: 18.53, admin1: 'Pomerania', country: 'Poland' },
    ],
  },
  place: {
    city: 'Kraków',
    locality: 'Kraków',
    principalSubdivision: 'Lesser Poland Voivodeship',
    countryName: 'Poland',
  },
};

