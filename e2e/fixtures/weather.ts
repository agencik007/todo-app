/** Canned answers of the weather widget's third-party APIs. */
export const weatherMock = {
  forecast: {
    timezone: 'Europe/Warsaw',
    current: {
      temperature_2m: 20.4,
      apparent_temperature: 18.6,
      relative_humidity_2m: 55,
      wind_speed_10m: 5.2,
      weather_code: 0,
      is_day: 1,
    },
  },
  place: {
    city: 'Kraków',
    locality: 'Kraków',
    principalSubdivision: 'Lesser Poland Voivodeship',
    countryName: 'Poland',
  },
};
