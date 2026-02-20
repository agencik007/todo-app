import { httpResource } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

export interface WeatherData {
    temperature: number;
    windSpeed: number;
    weatherCode: number;
}

@Injectable({
    providedIn: 'root',
})
export class WeatherService {
    readonly #apiUrl = 'https://api.open-meteo.com/v1/forecast';

    // Internal state for location (coordinates)
    readonly #location = signal<{ lat: number; lon: number } | null>(null);

    // Resource for fetching raw weather data
    // It automatically refetches when #location signal changes
    readonly #weatherResource = httpResource<any>(() => {
        const loc = this.#location();
        if (!loc) return undefined;

        // Construct URL only when location is available
        return `${this.#apiUrl}?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,wind_speed_10m,weather_code`;
    });

    // Publicly exposed signal with transformed data
    readonly weather = computed<WeatherData | null>(() => {
        const raw = this.#weatherResource.value();
        if (!raw) return null;

        return {
            temperature: raw.current.temperature_2m,
            windSpeed: raw.current.wind_speed_10m,
            weatherCode: raw.current.weather_code,
        };
    });

    readonly isLoading = this.#weatherResource.isLoading;
    readonly error = this.#weatherResource.error;

    // Action to update location and trigger fetch
    fetchWeather(lat: number, lon: number): void {
        this.#location.set({ lat, lon });
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
}
