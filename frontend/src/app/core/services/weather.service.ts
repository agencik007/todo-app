import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

export interface WeatherData {
    temperature: number;
    windSpeed: number;
    weatherCode: number;
    cityName?: string;
}

@Injectable({
    providedIn: 'root',
})
export class WeatherService {
    readonly #http = inject(HttpClient);
    readonly #apiUrl = 'https://api.open-meteo.com/v1/forecast';
    readonly #geoUrl = 'https://nominatim.openstreetmap.org/reverse';

    getCurrentWeather(lat: number, lon: number): Observable<WeatherData> {
        const weatherUrl = `${this.#apiUrl}?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code`;

        return this.#http.get<any>(weatherUrl).pipe(
            map((weatherResponse: any) => {
                const data: WeatherData = {
                    temperature: weatherResponse.current.temperature_2m,
                    windSpeed: weatherResponse.current.wind_speed_10m,
                    weatherCode: weatherResponse.current.weather_code,
                };
                return data;
            }),
        );
    }

    getCityName(lat: number, lon: number): Observable<string> {
        const url = `${this.#geoUrl}?format=json&lat=${lat}&lon=${lon}`;
        return this.#http.get<any>(url).pipe(
            map((response: any) => {
                const address = response.address;
                return (
                    address.city ||
                    address.town ||
                    address.village ||
                    address.suburb ||
                    'Unknown'
                );
            }),
        );
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
