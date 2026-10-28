import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { ChosenLocation } from '../models/weather.model';

/** Shape of the open-meteo geocoding /v1/search response (fields we use). */
interface GeocodingResponse {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
    admin1?: string;
    country?: string;
  }[];
}

/** City search for the weather widget, by name (no device location sent). */
@Injectable({
  providedIn: 'root',
})
export class LocationSearchService {
  readonly #http = inject(HttpClient);

  readonly #apiUrl = 'https://geocoding-api.open-meteo.com/v1/search';

  /** Up to 5 matching cities; an empty list when the search fails. */
  search(query: string, lang: string): Observable<ChosenLocation[]> {
    return this.#http
      .get<GeocodingResponse>(this.#apiUrl, {
        params: { name: query, count: 5, language: lang, format: 'json' },
      })
      .pipe(
        map(({ results }) =>
          (results ?? []).map((result) => ({
            name: result.name,
            region:
              [result.admin1, result.country].filter(Boolean).join(', ') ||
              null,
            latitude: result.latitude,
            longitude: result.longitude,
          })),
        ),
        catchError(() => of([])),
      );
  }
}
